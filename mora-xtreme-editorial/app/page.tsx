'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { 
  Users, CheckCircle, Edit3, Plus, Archive, LayoutDashboard, 
  Trash2, RotateCcw, AlertOctagon, Calendar, Bell, ChevronDown, ChevronUp 
} from 'lucide-react'

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [viewMode, setViewMode] = useState<'active' | 'archive' | 'trash'>('active')
  
  const [adminCols, setAdminCols] = useState<Record<string, boolean>>({ Drafting: true, Review: true, Approved: true })
  const [editorCols, setEditorCols] = useState({ drafts: true, review: true })

  const [currentUserId, setCurrentUserId] = useState('') 
  const [userRole, setUserRole] = useState<'editor' | 'admin'>('editor')
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true;

    const fetchUserAndData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && isMounted) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile) setUserRole(profile.role)
        
        const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        if (notifs) setNotifications(notifs)
      }

      const { data } = await supabase.from('tasks').select('*')
      if (data && isMounted) setTasks(data)
    }
    
    fetchUserAndData()

    // 1. Presence Sync (Who is online)
    const room = supabase.channel('editorial_room')
    room.on('presence', { event: 'sync' }, () => {
      const newState = room.presenceState()
      if (isMounted) setOnlineUsers(Object.keys(newState).map(key => (newState[key][0] as any).user_id))
    }).subscribe(async (status) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (status === 'SUBSCRIBED' && user) await room.track({ user_id: user.id, online_at: new Date().toISOString() })
    })

    // 2. Realtime Database Sync (Live Tasks & Notifications)
    const dbChanges = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        // Re-fetch tasks when anything changes
        supabase.from('tasks').select('*').then(({data}) => {
          if (data && isMounted) setTasks(data)
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
         // Re-fetch notifications for current user
         supabase.auth.getUser().then(({data: {user}}) => {
            if (user) {
              supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({data}) => {
                if (data && isMounted) setNotifications(data)
              })
            }
         })
      })
      .subscribe()

    return () => { 
      isMounted = false;
      supabase.removeChannel(room);
      supabase.removeChannel(dbChanges);
    }
  }, [supabase])

  const handleAddTask = async () => {
    const title = prompt("Enter the new task title:")
    if (!title) return
    await supabase.from('tasks').insert([{ title: title, status: 'Drafting', created_by: currentUserId }])
  }

  const markNotifsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUserId)
    setNotifications(notifications.map(n => ({ ...n, is_read: true })))
  }

  const handleRestoreTask = async (id: string) => {
    await supabase.from('tasks').update({ status: 'Drafting' }).eq('id', id)
  }

  const handlePermanentDelete = async (id: string) => {
    if (window.confirm("Permanently delete this task? This cannot be undone.")) {
      await supabase.from('tasks').delete().eq('id', id)
    }
  }

  const getDeadlineBadge = (dateStr: string) => {
    if (!dateStr) return <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Calendar size={12}/> No deadline</span>
    const today = new Date(); today.setHours(0,0,0,0);
    const deadline = new Date(dateStr); deadline.setHours(0,0,0,0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">{Math.abs(diffDays)} days late!</span>
    if (diffDays === 0) return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">Due Today!</span>
    if (diffDays <= 2) return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold border border-orange-200 flex items-center gap-1"><Calendar size={12}/> {diffDays} days left</span>
    return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200 flex items-center gap-1"><Calendar size={12}/> {diffDays} days left</span>
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.pr_date) return 1; if (!b.pr_date) return -1;
    return new Date(a.pr_date).getTime() - new Date(b.pr_date).getTime();
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="p-4 md:p-10 min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 relative">
        <h1 className="text-2xl md:text-3xl font-bold">Mora Xtreme Editorial</h1>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-green-600 font-medium md:mr-2 text-sm md:text-base">
            <Users size={20} /><span>{onlineUsers.length} Online</span>
          </div>
          
          <div className="relative">
            <button onClick={() => { setShowNotifs(!showNotifs); markNotifsRead(); }} className="p-2 rounded-full hover:bg-gray-200 relative transition">
              <Bell size={20} />
              {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>}
            </button>
            
            {/* NOTIFICATION MENU - Mobile safe positioning */}
            {showNotifs && (
              <div className="absolute right-[-10px] sm:right-0 mt-3 w-[320px] max-w-[90vw] md:w-80 bg-white border border-gray-200 shadow-2xl rounded-lg overflow-hidden z-[100]">
                <div className="p-3 bg-gray-50 border-b font-semibold text-sm">Notifications</div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? <p className="p-4 text-sm text-gray-500 text-center">All caught up!</p> : 
                    notifications.map(n => (
                      <Link 
                        href={n.task_id ? `/task/${n.task_id}` : '#'} 
                        key={n.id} 
                        onClick={() => setShowNotifs(false)}
                        className={`block p-3 text-sm border-b hover:bg-gray-100 transition ${n.is_read ? 'bg-white text-gray-700' : 'bg-blue-50/50 text-blue-900 font-medium'}`}
                      >
                        {n.message}
                        <div className="text-[10px] text-gray-500 mt-1">{new Date(n.created_at).toLocaleDateString()}</div>
                      </Link>
                    ))
                  }
                </div>
              </div>
            )}
          </div>

          {userRole === 'admin' && (
            <div className="flex bg-gray-200 rounded p-1 overflow-x-auto w-full md:w-auto">
              <button onClick={() => setViewMode('active')} className={`flex items-center gap-2 px-3 py-2 whitespace-nowrap rounded font-medium text-sm transition ${viewMode === 'active' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}><LayoutDashboard size={16} /> Board</button>
              <button onClick={() => setViewMode('archive')} className={`flex items-center gap-2 px-3 py-2 whitespace-nowrap rounded font-medium text-sm transition ${viewMode === 'archive' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}><Archive size={16} /> Archive</button>
              <button onClick={() => setViewMode('trash')} className={`flex items-center gap-2 px-3 py-2 whitespace-nowrap rounded font-medium text-sm transition ${viewMode === 'trash' ? 'bg-white shadow text-red-600' : 'text-gray-600 hover:text-gray-900'}`}><Trash2 size={16} /> Trash</button>
            </div>
          )}

          {userRole === 'admin' && (
            <button onClick={handleAddTask} className="flex flex-1 md:flex-none justify-center items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
              <Plus size={18} /> New Task
            </button>
          )}
        </div>
      </header>

      {/* EDITOR VIEW */}
      {userRole === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
            <button onClick={() => setEditorCols({...editorCols, drafts: !editorCols.drafts})} className="w-full flex justify-between items-center mb-2 md:mb-4 outline-none">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-700"><Edit3 size={20} /> Active Drafts</h2>
              {editorCols.drafts ? <ChevronUp size={20} className="text-gray-500 hover:text-gray-800 transition"/> : <ChevronDown size={20} className="text-gray-500 hover:text-gray-800 transition"/>}
            </button>
            
            {editorCols.drafts && (
              <div className="flex flex-col gap-4 mt-4">
                {sortedTasks.filter(t => t.assignee_id === currentUserId && t.status === 'Drafting').map(task => (
                  <Link href={`/task/${task.id}`} key={task.id} className="block p-4 md:p-5 border rounded-lg bg-gray-50 hover:bg-white hover:shadow-md transition hover:border-blue-300">
                    <h3 className="font-semibold text-base md:text-lg mb-3">{task.title}</h3>
                    <div className="flex justify-between items-center">{getDeadlineBadge(task.pr_date)}</div>
                  </Link>
                ))}
                {sortedTasks.filter(t => t.assignee_id === currentUserId && t.status === 'Drafting').length === 0 && <p className="text-gray-500 italic text-sm">No drafts pending.</p>}
              </div>
            )}
          </div>

          <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-blue-200 h-fit">
            <button onClick={() => setEditorCols({...editorCols, review: !editorCols.review})} className="w-full flex justify-between items-center mb-2 md:mb-4 outline-none">
              <h2 className="text-xl font-bold flex items-center gap-2 text-blue-600"><CheckCircle size={20} /> Pending Admin Review</h2>
              {editorCols.review ? <ChevronUp size={20} className="text-gray-500 hover:text-gray-800 transition"/> : <ChevronDown size={20} className="text-gray-500 hover:text-gray-800 transition"/>}
            </button>

            {editorCols.review && (
              <div className="flex flex-col gap-4 mt-4">
                {sortedTasks.filter(t => t.assignee_id === currentUserId && t.status === 'Review').map(task => (
                  <Link href={`/task/${task.id}`} key={task.id} className="block p-4 md:p-5 border border-blue-100 rounded-lg bg-blue-50/30 hover:bg-white hover:shadow-md transition">
                    <h3 className="font-semibold text-base md:text-lg mb-3">{task.title}</h3>
                    <div className="flex justify-between items-center">{getDeadlineBadge(task.pr_date)}</div>
                  </Link>
                ))}
                {sortedTasks.filter(t => t.assignee_id === currentUserId && t.status === 'Review').length === 0 && <p className="text-gray-500 italic text-sm">Nothing currently in review.</p>}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ADMIN VIEW */}
      {userRole === 'admin' && viewMode === 'active' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {['Drafting', 'Review', 'Approved'].map(status => (
            <div key={status} className="bg-white p-4 md:p-5 rounded-lg shadow border border-gray-200 h-fit">
              
              <button onClick={() => setAdminCols({...adminCols, [status]: !adminCols[status]})} className="w-full flex justify-between items-center mb-2 md:mb-4 outline-none">
                <h2 className="text-xl font-semibold flex items-center gap-2">{status}</h2>
                {adminCols[status] ? <ChevronUp size={20} className="text-gray-500 hover:text-gray-800 transition"/> : <ChevronDown size={20} className="text-gray-500 hover:text-gray-800 transition"/>}
              </button>

              {adminCols[status] && (
                <div className="space-y-4 mt-4">
                  {sortedTasks.filter(t => t.status === status).map(task => (
                    <Link href={`/task/${task.id}`} key={task.id} className="block p-4 border rounded-lg bg-gray-50 hover:shadow-md transition cursor-pointer relative">
                      <h3 className="font-medium mb-3 text-sm md:text-base">{task.title}</h3>
                      {getDeadlineBadge(task.pr_date)}
                    </Link>
                  ))}
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {userRole === 'admin' && viewMode === 'archive' && (
         <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
         <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-700"><Archive size={24} /> Completed Tasks Archive</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {tasks.filter(t => t.status === 'Completed').map(task => (
             <Link href={`/task/${task.id}`} key={task.id} className="block p-4 md:p-5 border rounded-lg bg-gray-50 hover:bg-white hover:shadow-md transition opacity-75 hover:opacity-100">
               <h3 className="font-medium text-gray-900 strike line-through decoration-gray-400">{task.title}</h3>
             </Link>
           ))}
         </div>
       </div>
      )}

      {userRole === 'admin' && viewMode === 'trash' && (
        <div className="bg-red-50 p-4 md:p-6 rounded-lg shadow-sm border border-red-100 h-fit">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-red-700"><Trash2 size={24} /> Trash Bin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.filter(t => t.status === 'Trash').map(task => (
              <div key={task.id} className="p-4 border border-red-200 rounded-lg bg-white shadow-sm flex flex-col justify-between">
                <h3 className="font-medium text-gray-900 mb-4">{task.title}</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleRestoreTask(task.id)} className="flex-1 flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm transition font-medium"><RotateCcw size={14} /> Restore</button>
                  <button onClick={() => handlePermanentDelete(task.id)} className="flex-1 flex items-center justify-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded text-sm transition font-medium"><AlertOctagon size={14} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}