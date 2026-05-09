import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PasswordReset() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenValid, setTokenValid] = useState(null)
  
  const searchParams = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  useEffect(() => {
    if (token) {
      // Validate token by attempting to use it
      const validateToken = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/verify?token=${token}`, {
            method: 'GET',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            }
          })
          
          if (response.ok) {
            setTokenValid(true)
          } else {
            setTokenValid(false)
          }
        } catch (error) {
          console.error('Token validation error:', error)
          setTokenValid(false)
        }
      }

      validateToken()
    } else {
      setTokenValid(false)
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/auth')
        }, 2000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || 'Failed to reset password')
      }
    } catch (error) {
      console.error('Password reset error:', error)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-leaf-800 mb-2">Sown</h1>
                <p className="text-gray-600">Resetting your password...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-leaf-800 mb-2">Sown</h1>
                <p className="text-red-600">Invalid or expired reset link</p>
                <p className="text-gray-600 mt-2">Please request a new password reset.</p>
                <button
                  onClick={() => navigate('/auth')}
                  className="mt-4 w-full bg-leaf-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-leaf-700 transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-leaf-800 mb-2">Sown</h1>
              <p className="text-gray-600">Set your new password</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-600 text-sm">Password reset successfully! Redirecting to sign in...</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-leaf-500 focus:border-transparent"
                  placeholder="Enter your new password"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-leaf-500 focus:border-transparent"
                  placeholder="Confirm your new password"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-leaf-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-leaf-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/auth')}
                className="text-leaf-600 hover:text-leaf-800 text-sm font-medium transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  )
}
