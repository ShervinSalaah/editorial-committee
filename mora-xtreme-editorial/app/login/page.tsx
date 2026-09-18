'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'
import { Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (action: 'login' | 'signup') => {
    setLoading(true)
    setErrorMsg('')
    
    const { error } = action === 'login' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      router.push('/') // Redirect to dashboard on success
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Mora Xtreme Editorial</h1>
        
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="editor@moraxtreme.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => handleAuth('login')}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white p-3 rounded font-medium hover:bg-blue-700 transition flex justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>
            <button 
              onClick={() => handleAuth('signup')}
              disabled={loading}
              className="flex-1 bg-gray-700 text-white p-3 rounded font-medium hover:bg-gray-600 transition flex justify-center"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}