/**
 * Vercel Serverless API for Database Sync
 * Handles bidirectional sync between client and server
 */

import { NextResponse } from "next/server"

// In production, replace with actual database (Vercel Postgres, Supabase, etc.)
// For now, using in-memory storage (replace with real DB)
let serverDatabase = {
  products: [],
  transactions: [],
  users: [],
  inventory: [],
}

export async function POST(request) {
  try {
    const { queue, timestamp } = await request.json()

    console.log(`📥 Received ${queue.length} items to sync at ${timestamp}`)

    const results = []

    // Process each queued operation
    for (const item of queue) {
      const { action, storeName, data } = item

      switch (action) {
        case "add":
          if (!serverDatabase[storeName]) {
            serverDatabase[storeName] = []
          }
          // Check if already exists (prevent duplicates)
          const existingIndex = serverDatabase[storeName].findIndex((d) => d.id === data.id)
          if (existingIndex === -1) {
            serverDatabase[storeName].push({
              ...data,
              syncedAt: new Date().toISOString(),
            })
            results.push({ success: true, action: "added", id: data.id })
          } else {
            results.push({ success: true, action: "already_exists", id: data.id })
          }
          break

        case "update":
          if (serverDatabase[storeName]) {
            const updateIndex = serverDatabase[storeName].findIndex((d) => d.id === data.id)
            if (updateIndex !== -1) {
              serverDatabase[storeName][updateIndex] = {
                ...data,
                syncedAt: new Date().toISOString(),
              }
              results.push({ success: true, action: "updated", id: data.id })
            } else {
              // Item doesn't exist, create it
              serverDatabase[storeName].push({
                ...data,
                syncedAt: new Date().toISOString(),
              })
              results.push({ success: true, action: "created", id: data.id })
            }
          }
          break

        case "delete":
          if (serverDatabase[storeName]) {
            serverDatabase[storeName] = serverDatabase[storeName].filter((d) => d.id !== data.id)
            results.push({ success: true, action: "deleted", id: data.id })
          }
          break

        default:
          results.push({ success: false, error: "Unknown action", action })
      }
    }

    return NextResponse.json({
      success: true,
      synced: results.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Sync error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")

    if (action === "pull") {
      // Return all server data for client to sync
      return NextResponse.json({
        ...serverDatabase,
        timestamp: new Date().toISOString(),
      })
    }

    // Default: return sync status
    return NextResponse.json({
      status: "online",
      database: Object.keys(serverDatabase).map((key) => ({
        store: key,
        count: serverDatabase[key]?.length || 0,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ GET error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
