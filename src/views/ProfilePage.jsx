"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import TopBar from "../components/TopBar"
import { auth, db, isFirebaseConfigured, uploadFileToStorage } from "../config/firebase"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { getAdminIdForStorage } from "../utils/auth"

/**
 * Profile Page (plain English):
 * - Lets a logged-in user change their display name and profile photo (avatar).
 * - Photo upload goes to Firebase Storage under:
 *     organizations/{adminId}/avatars/{uid}/{fileName}
 * - We then save the image URL to Firestore:
 *     userProfiles/{uid}
 *     organizations/{adminId}/users/{uid}   (mirror for admin dashboards)
 */
export default function ProfilePage({ currentUser, userRole, onUserUpdate }) {
  const [name, setName] = useState(currentUser?.name || "")
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const fileInputRef = useRef(null)

  const uid = currentUser?.id || currentUser?.uid || null
  const adminId = useMemo(() => {
    if (!currentUser) return null
    return currentUser.adminId || getAdminIdForStorage(currentUser)
  }, [currentUser])

  const existingPhotoUrl =
    currentUser?.photoURL ||
    currentUser?.avatarUrl ||
    null

  useEffect(() => {
    setName(currentUser?.name || "")
  }, [currentUser?.name])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  const validateFile = (file) => {
    if (!file) return "Please choose an image"
    if (!file.type?.startsWith("image/")) return "Only image files are allowed"
    // We ACCEPT larger photos here, then we auto-compress them before upload
    // so they pass the Firebase Storage security limit.
    const maxPickBytes = 15 * 1024 * 1024
    if (file.size > maxPickBytes) return "Image is too large (max 15MB). Please choose a smaller photo."
    return null
  }

  /**
   * Make big photos smaller (plain English):
   * - Phones often take huge images (5MB-20MB).
   * - Our Storage security rules block uploads above 2MB.
   * - So we resize/compress the image in the browser first, then upload the smaller file.
   */
  const compressImageToMaxBytes = async (file, maxBytes) => {
    if (!file || !file.type?.startsWith("image/")) return file
    if (file.size <= maxBytes) return file

    const blobToFile = (blob, name) => new File([blob], name, { type: blob.type || "image/jpeg" })

    // Prefer createImageBitmap (fast). Fallback to <img> if needed.
    let bitmap = null
    try {
      bitmap = await createImageBitmap(file)
    } catch (e) {
      bitmap = null
    }

    const img = await new Promise((resolve, reject) => {
      if (bitmap) return resolve(bitmap)
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = URL.createObjectURL(file)
    })

    // Resize to a reasonable max dimension to keep quality but reduce size.
    const originalW = img.width
    const originalH = img.height
    const maxDim = 1024
    const scale = Math.min(1, maxDim / Math.max(originalW, originalH))
    const targetW = Math.max(1, Math.round(originalW * scale))
    const targetH = Math.max(1, Math.round(originalH * scale))

    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext("2d")
    if (!ctx) return file

    ctx.drawImage(img, 0, 0, targetW, targetH)

    // Try a few qualities until we fit under maxBytes.
    const name = (file.name || "avatar.jpg").replace(/\.[^/.]+$/, "") + ".jpg"
    const qualities = [0.85, 0.75, 0.65, 0.55, 0.45]

    for (const q of qualities) {
      // eslint-disable-next-line no-await-in-loop
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q))
      if (!blob) continue
      if (blob.size <= maxBytes) return blobToFile(blob, name)
    }

    // Last resort: return the smallest we managed (even if slightly above).
    const fallbackBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.4))
    if (fallbackBlob) return blobToFile(fallbackBlob, name)
    return file
  }

  const refreshTokenAndCheckOrgClaim = async (expectedAdminId) => {
    if (!auth?.currentUser) return { ok: false, reason: "Not signed in." }
    try {
      // Force refresh so newly-set custom claims are picked up.
      await auth.currentUser.getIdToken(true)
      const res = await auth.currentUser.getIdTokenResult()
      const tokenAdminId = res?.claims?.adminId || null
      if (tokenAdminId !== expectedAdminId) {
        return {
          ok: false,
          reason:
            "Your login token does not yet have organization permissions. Please logout and login again (or wait 1 minute) then retry.",
        }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: "Could not refresh login token. Please logout and login again." }
    }
  }

  const onPickFile = (file) => {
    setError("")
    setSuccess("")
    const fileError = validateFile(file)
    if (fileError) {
      setSelectedFile(null)
      setError(fileError)
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) onPickFile(file)
  }

  const handleSave = async () => {
    setError("")
    setSuccess("")

    if (!uid) {
      setError("Missing user ID. Please logout and login again.")
      return
    }
    if (!adminId) {
      setError("Missing adminId for organization. Please logout and login again.")
      return
    }
    if (!isFirebaseConfigured() || !db) {
      setError("Firebase is not configured. Please check your .env.local and reload.")
      return
    }
    if (!name.trim()) {
      setError("Name cannot be empty.")
      return
    }

    setIsSaving(true)
    try {
      let photoURL = existingPhotoUrl

      // Upload avatar if user picked one
      if (selectedFile) {
        // Ensure our token has the adminId claim needed by Storage rules.
        const claimCheck = await refreshTokenAndCheckOrgClaim(adminId)
        if (!claimCheck.ok) {
          setError(claimCheck.reason)
          setIsSaving(false)
          return
        }

        // Compress/resize if needed so it fits the 2MB Storage rule.
        const maxUploadBytes = 2 * 1024 * 1024
        const uploadFile = await compressImageToMaxBytes(selectedFile, maxUploadBytes)
        if (uploadFile.size > maxUploadBytes) {
          setError("This photo is still too large after compression. Please choose a smaller photo.")
          setIsSaving(false)
          return
        }

        const safeName = (selectedFile.name || "avatar")
          .replace(/[^\w.\-]+/g, "_")
          .slice(0, 80)
        const path = `organizations/${adminId}/avatars/${uid}/${Date.now()}_${safeName}`

        photoURL = await uploadFileToStorage(uploadFile, path)
      }

      const patch = {
        name: name.trim(),
        photoURL: photoURL || null,
        avatarUrl: photoURL || null,
        updatedAt: serverTimestamp(),
      }

      // Update global user profile
      await setDoc(doc(db, "userProfiles", uid), patch, { merge: true })
      // Mirror into org-scoped users (admin dashboard realtime reads)
      await setDoc(doc(db, "organizations", adminId, "users", uid), patch, { merge: true })

      // Update app state (no need to reload)
      if (onUserUpdate) {
        onUserUpdate({
          name: patch.name,
          photoURL: patch.photoURL,
          avatarUrl: patch.avatarUrl,
        })
      }

      setSelectedFile(null)
      setSuccess("Profile updated successfully.")
    } catch (e) {
      console.error("Profile update failed:", e)
      const message = e?.message || "Profile update failed. Please try again."
      if (String(message).toLowerCase().includes("storage/unauthorized")) {
        setError(
          "Upload blocked by security rules. Please logout and login again so your account picks up organization permissions, then retry."
        )
      } else {
        setError(message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar title="My Profile" subtitle={userRole ? `Signed in as ${userRole}` : undefined} />

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto bg-card rounded-xl shadow-xl border-2 border-border p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Profile Details</h2>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500 rounded-lg">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-1">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#D4AF37]/40 bg-muted flex items-center justify-center mx-auto">
                {previewUrl || existingPhotoUrl ? (
                  <img
                    src={previewUrl || existingPhotoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {(name?.trim()?.[0] || "U").toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Max 2MB. PNG/JPG recommended.
              </p>
            </div>

            <div className="md:col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Profile photo</label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="w-full p-5 border-2 border-dashed border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col gap-2 items-start">
                    <div className="text-sm text-foreground font-medium">
                      Drag & drop an image here, or choose a file.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      The photo is uploaded to Firebase Storage and the URL is saved to your profile.
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                      >
                        Choose file
                      </button>
                      {selectedFile && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          Selected: {selectedFile.name}
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-3 rounded-lg bg-[#6B0F1A] text-white hover:bg-[#8B1E2A] transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setSuccess("")
                    setSelectedFile(null)
                    setName(currentUser?.name || "")
                  }}
                  disabled={isSaving}
                  className="px-6 py-3 rounded-lg border-2 border-border text-foreground hover:bg-muted/40 transition-colors font-medium disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

