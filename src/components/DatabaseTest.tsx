import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DatabaseTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Testing connection...')
  const [plants, setPlants] = useState<any[]>([])

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test basic connection
        const { data, error } = await supabase.from('plants').select('count').limit(1)
        
        if (error) {
          setStatus(`❌ Connection failed: ${error.message}`)
        } else {
          setStatus('✅ Database connection successful!')
          
          // Get sample data
          const { data: plantData } = await supabase.from('plants').select('*').limit(5)
          setPlants(plantData || [])
        }
      } catch (err) {
        setStatus(`❌ Error: ${err}`)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">Database Connection Test</h2>
      <p className="mb-4">{status}</p>
      
      {plants.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Sample plants:</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            {plants.map((plant) => (
              <li key={plant.id}>• {plant.common_name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default DatabaseTest
