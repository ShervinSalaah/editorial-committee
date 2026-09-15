'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Users, CheckCircle, Edit3 } from 'lucide-react'

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Fetch Tasks
    const fetchTasks = async () => {
      const { data } = await supabase.from('tasks').select('*')
      if (data) setTasks(data)
    }
    fetchTasks()

    // Realtime Presence Channel
    const room = supabase.channel('editorial_room')
    
    room.on('presence', { event: 'sync' }, () => {
      const newState = room.presenceState()
      // Extract user IDs from the state
      const users = Object.keys(newState).map(key => newState[key][0].user_id)
      setOnlineUsers(users)
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await room.track({ user_id: 'current_user_id', online_at: new Date().toISOString() })
      }
    })

    return () => { supabase.removeChannel(room) }
  }, [])

  return (
    <div className="p-10 min-h-screen bg-gray-50 text-gray-900">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Mora Xtreme Editorial</h1>
        <div className="flex items-center gap-2 text-green-600 font-medium">
          <Users size={20} />
          <span>{onlineUsers.length} Online Now</span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6">
        {/* Kanban Columns */}
        {['Drafting', 'Review', 'Approved'].map(status => (
          <div key={status} className="bg-white p-5 rounded-lg shadow border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {status === 'Drafting' && <Edit3 size={18}/>}
              {status === 'Approved' && <CheckCircle size={18} className="text-green-500"/>}
              {status}
            </h2>
            <div className="space-y-4">
              {tasks.filter(t => t.status === status).map(task => (
                <div key={task.id} className="p-4 border rounded bg-gray-50 hover:shadow-md transition">
                  <h3 className="font-medium">{task.title}</h3>
                  <p className="text-sm text-gray-500 mt-2">Due: {task.pr_date}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}