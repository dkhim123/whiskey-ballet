/**
 * IndexedDB Migration Component
 * UI for migrating data from localStorage to IndexedDB
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Progress } from '../../components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import {
  migrateAllAdmins,
  verifyMigration,
  isMigrationCompleted,
  rollbackMigration
} from '../utils/migrationUtility'
import { isIndexedDBAvailable, getStorageStats } from '../utils/indexedDBStorage'
import { enableIndexedDB, disableIndexedDB } from '../utils/storage'
import { CheckCircle, AlertCircle, Database, HardDrive, ArrowRight, Info } from 'lucide-react'

export default function MigrationComponent({ onMigrationComplete }) {
  const [migrationStatus, setMigrationStatus] = useState('idle') // idle, running, completed, error
  const [migrationProgress, setMigrationProgress] = useState(0)
  const [migrationPhase, setMigrationPhase] = useState('')
  const [migrationResults, setMigrationResults] = useState(null)
  const [verificationResults, setVerificationResults] = useState(null)
  const [error, setError] = useState(null)

  const isMigrated = isMigrationCompleted()
  const isIndexedDBSupported = isIndexedDBAvailable()

  const handleMigrate = async () => {
    try {
      setMigrationStatus('running')
      setError(null)
      setMigrationProgress(0)
      setMigrationPhase('Starting migration...')

      const result = await migrateAllAdmins((progress) => {
        if (progress.phase) {
          setMigrationPhase(progress.phase)
        }
        if (progress.percentage) {
          setMigrationProgress(progress.percentage)
        }
      })

      setMigrationResults(result)

      if (result.success) {
        // Enable IndexedDB
        enableIndexedDB()
        
        setMigrationStatus('completed')
        setMigrationPhase('Migration completed successfully!')
        setMigrationProgress(100)

        if (onMigrationComplete) {
          onMigrationComplete(result)
        }
      } else {
        throw new Error('Migration failed')
      }
    } catch (err) {
      console.error('Migration error:', err)
      setError(err.message)
      setMigrationStatus('error')
      setMigrationPhase('Migration failed')
    }
  }

  const handleVerify = async () => {
    try {
      setMigrationPhase('Verifying migration...')
      
      // Get all admin IDs from migration results
      const adminIds = migrationResults?.admins?.map(a => a.adminId) || [null]
      
      const verifications = []
      for (const adminId of adminIds) {
        const result = await verifyMigration(adminId)
        verifications.push({ adminId, ...result })
      }
      
      setVerificationResults(verifications)
      setMigrationPhase('Verification completed')
    } catch (err) {
      console.error('Verification error:', err)
      setError(err.message)
    }
  }

  const handleRollback = () => {
    if (confirm('Are you sure you want to rollback the migration? This will disable IndexedDB and revert to localStorage.')) {
      rollbackMigration()
      disableIndexedDB()
      window.location.reload()
    }
  }

  if (!isIndexedDBSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            IndexedDB Not Supported
          </CardTitle>
          <CardDescription>
            Your browser doesn't support IndexedDB. Please use a modern browser (Chrome, Firefox, Safari, or Edge).
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Storage Migration
          </CardTitle>
          <CardDescription>
            Migrate your data from localStorage to IndexedDB for better performance and larger storage capacity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Migration Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-gray-400" />
              <div>
                <p className="font-medium">localStorage</p>
                <p className="text-sm text-gray-500">Limited capacity (~10 MB)</p>
              </div>
            </div>
            
            <ArrowRight className="h-6 w-6 text-gray-400" />
            
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">IndexedDB</p>
                <p className="text-sm text-gray-500">Large capacity (50+ MB)</p>
              </div>
            </div>
          </div>

          {/* Migration Info */}
          {!isMigrated && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Why migrate to IndexedDB?</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Store 5000-10000+ products and transactions</li>
                  <li>Faster data retrieval with indexed queries</li>
                  <li>Better performance for large datasets</li>
                  <li>Admin-specific data isolation</li>
                  <li>No localStorage quota exceeded errors</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Current Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Current Status:</span>
            {isMigrated ? (
              <Badge variant="success" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                IndexedDB Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                localStorage Active
              </Badge>
            )}
          </div>

          {/* Migration Progress */}
          {migrationStatus === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{migrationPhase}</span>
                <span className="text-sm text-gray-500">{migrationProgress}%</span>
              </div>
              <Progress value={migrationProgress} className="w-full" />
            </div>
          )}

          {/* Migration Results */}
          {migrationResults && migrationStatus === 'completed' && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Migration Successful!</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <p>{migrationResults.message}</p>
                  {migrationResults.admins && migrationResults.admins.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Migrated data for {migrationResults.admins.length} admin(s):</p>
                      <ul className="list-disc list-inside mt-1">
                        {migrationResults.admins.map((admin, idx) => (
                          <li key={idx}>
                            Admin {admin.adminId || 'shared'}: {admin.details?.inventory?.success || 0} products, {admin.details?.transactions?.success || 0} transactions
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Verification Results */}
          {verificationResults && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Verification Results</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2 text-sm">
                  {verificationResults.map((result, idx) => (
                    <div key={idx}>
                      <p className="font-medium">Admin {result.adminId || 'shared'}:</p>
                      <div className="grid grid-cols-2 gap-2 mt-1 ml-4">
                        {result.details && Object.entries(result.details).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="capitalize">{key}:</span> {value.match ? '✅' : '❌'} (LS: {value.localStorage}, IDB: {value.indexedDB})
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isMigrated && (
              <Button
                onClick={handleMigrate}
                disabled={migrationStatus === 'running'}
                className="flex-1"
              >
                {migrationStatus === 'running' ? 'Migrating...' : 'Start Migration'}
              </Button>
            )}
            
            {migrationStatus === 'completed' && (
              <Button
                onClick={handleVerify}
                variant="outline"
                className="flex-1"
              >
                Verify Migration
              </Button>
            )}
            
            {isMigrated && (
              <Button
                onClick={handleRollback}
                variant="outline"
                className="flex-1"
              >
                Rollback to localStorage
              </Button>
            )}
          </div>

          {/* Post-migration note */}
          {isMigrated && !migrationResults && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Migration Already Completed</AlertTitle>
              <AlertDescription>
                Your data has been migrated to IndexedDB. You can rollback to localStorage if needed, but this is not recommended.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
