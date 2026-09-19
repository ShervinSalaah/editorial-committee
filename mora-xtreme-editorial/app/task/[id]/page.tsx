'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'
import { 
  ArrowLeft, Save, Sparkles, Loader2, History, MessageSquare, Send, 
  Trash2, CheckCircle, RotateCcw, Smartphone, Monitor, Sun, Moon, ImageIcon, 
  Users, Smile, Bold, Italic 
} from 'lucide-react'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

export default function TaskEditor() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const taskId = params.id as string
  
  const [userRole, setUserRole] = useState<'editor' | 'admin'>('editor')
  const [userEmail, setUserEmail] = useState('')
  const [committeeMembers, setCommitteeMembers] = useState<any[]>([])
  
  const [task, setTask] = useState<any>(null)
  const [content, setContent] = useState('')
  const [versions, setVersions] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  
  const [activePanel, setActivePanel] = useState<'comments' | 'history' | 'whatsapp'>('whatsapp')
  const [isProcessing, setIsProcessing] = useState(false)

  const [waTheme, setWaTheme] = useState<'light' | 'dark'>('dark')
  const [waDevice, setWaDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [waContext, setWaContext] = useState<'group' | 'community'>('community')
  const [waMedia, setWaMedia] = useState<'text' | 'image'>('image')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setUserEmail(user.email || '')

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile) {
        setUserRole(profile.role)
        if (profile.role === 'admin') {
          const { data: members } = await supabase.from('profiles').select('id, email')
          if (members) setCommitteeMembers(members)
        }
      }

      const { data: taskData } = await supabase.from('tasks').select('*').eq('id', taskId).single()
      if (taskData) { setTask(taskData); setContent(taskData.content || '') }

      const { data: commentData } = await supabase.from('comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true })
      if (commentData) setComments(commentData)

      const { data: versionData } = await supabase.from('caption_versions').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
      if (versionData) setVersions(versionData)
    }
    if (taskId) fetchAll()
  }, [taskId, supabase, router])

  const formatUnicode = (text: string, type: 'bold' | 'italic') => {
    return text.split('').map(char => {
      const code = char.charCodeAt(0);
      if (type === 'bold') {
        if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120276 - 65); 
        if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120302 - 97); 
        if (code >= 48 && code <= 57) return String.fromCodePoint(code + 120812 - 48); 
      } else if (type === 'italic') {
        if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120328 - 65); 
        if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120354 - 97); 
      }
      return char; 
    }).join('');
  };

  const applyFormat = (type: 'bold' | 'italic') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return; 

    const selectedText = content.slice(start, end);
    const formattedText = formatUnicode(selectedText, type);
    const newContent = content.slice(0, start) + formattedText + content.slice(end);
    setContent(newContent);
    
    setTimeout(() => {
      el.setSelectionRange(start, start + formattedText.length);
      el.focus();
    }, 0);
  }

  const handleEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent(prev => prev + emoji);
      return;
    }
    const start = el.selectionStart;
    const newContent = content.slice(0, start) + emoji + content.slice(el.selectionEnd);
    setContent(newContent);
    setShowEmojiPicker(false);
    
    setTimeout(() => {
      el.setSelectionRange(start + emoji.length, start + emoji.length);
      el.focus();
    }, 0);
  }

  const updateTaskField = async (field: string, value: string | null) => {
    setTask({ ...task, [field]: value })
    await supabase.from('tasks').update({ [field]: value }).eq('id', taskId)
  }

  const saveSnapshot = async (textToSave: string) => {
    if (!textToSave) return
    await supabase.from('caption_versions').insert([{ task_id: taskId, previous_content: textToSave }])
    const { data } = await supabase.from('caption_versions').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
    if (data) setVersions(data)
  }

  const handleSave = async () => {
    setIsProcessing(true)
    await saveSnapshot(content) 
    await updateTaskField('content', content)
    setIsProcessing(false)
  }

 const handleDelete = async () => {
  if (window.confirm("Move this task to the Trash?")) {
    await updateTaskField('status', 'Trash')
    router.refresh() // <-- ADD THIS
    router.push('/')
  }
}

  const handlePolish = async () => {
    if (!content) return alert("Write some text first!")
    setIsProcessing(true)
    await saveSnapshot(content)
    try {
      const res = await fetch('/api/polish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftText: content })
      })
      const data = await res.json()
      if (res.ok && data.polished) setContent(data.polished)
      else alert(`Error: ${data.error}`)
    } catch (error) {
      alert("Failed to connect to AI server.")
    }
    setIsProcessing(false)
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('comments').insert([{ task_id: taskId, user_id: user?.id, user_email: userEmail, content: newComment }])
    setNewComment('')
    
    if (userRole === 'admin' && task.assignee_id) {
       await supabase.from('notifications').insert([{
         user_id: task.assignee_id,
         task_id: taskId,
         message: `Admin commented: "${newComment}"`
       }])

       const assignee = committeeMembers.find(m => m.id === task.assignee_id)
       if (assignee) {
         await fetch('/api/notify', { 
           method: 'POST', body: JSON.stringify({ to_email: assignee.email, subject: `New Admin Comment on ${task.title}`, message: `Admin commented: "${newComment}"`, taskUrl: window.location.href }) 
         })
       }
    }
    const { data } = await supabase.from('comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  const handleSendForReview = async () => {
    setIsProcessing(true)
    await handleSave()
    await supabase.from('tasks').update({ status: 'Review' }).eq('id', taskId)
    
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins && admins.length > 0) {
      const notifs = admins.map(admin => ({
        user_id: admin.id,
        task_id: taskId,
        message: `${userEmail} has sent "${task.title}" for review.`
      }))
      await supabase.from('notifications').insert(notifs)
    }

    await fetch('/api/notify', { 
      method: 'POST', body: JSON.stringify({ to_email: 'shervinsalaah@gmail.com', subject: `Task Ready for Review: ${task.title}`, message: `${userEmail} has sent "${task.title}" for review.`, taskUrl: window.location.href }) 
    })
    router.refresh() 
    router.push('/')
  }

  const handleApproveTask = async () => {
    setIsProcessing(true)
    await supabase.from('tasks').update({ status: 'Approved' }).eq('id', taskId)
    
    if (task.assignee_id) {
      await supabase.from('notifications').insert([{
        user_id: task.assignee_id,
        task_id: taskId,
        message: `Congratulations! "${task.title}" was approved by ${userEmail}.`
      }])

      const assignee = committeeMembers.find(m => m.id === task.assignee_id)
      if (assignee) {
        await fetch('/api/notify', { 
          method: 'POST', body: JSON.stringify({ to_email: assignee.email, subject: `Approved: ${task.title}`, message: `Congratulations! Your post "${task.title}" was approved by ${userEmail}.`, taskUrl: window.location.href }) 
        })
      }
    }
    router.refresh()
    router.push('/')
  }

  if (!task) return <div className="p-10 flex justify-center items-center h-screen text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading Editor...</div>

  return (
    <div className="w-full max-w-[1500px] mx-auto p-4 md:p-6 min-h-screen text-gray-100 overflow-x-hidden">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-lg gap-4">
        <div className="flex flex-wrap items-center gap-4 lg:gap-6 w-full lg:w-auto">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={18} /> Back</button>
          <div className="hidden lg:block h-6 w-px bg-gray-700"></div>
          
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-400 font-semibold tracking-widest uppercase mb-1">Status</label>
            <select value={task.status} onChange={(e) => updateTaskField('status', e.target.value)} className="text-sm font-bold tracking-wider uppercase bg-transparent border-none text-blue-500 focus:ring-0 cursor-pointer p-0">
              <option className="bg-gray-800" value="Drafting">Drafting</option>
              <option className="bg-gray-800" value="Review">Review</option>
              {userRole === 'admin' && (
                <>
                  <option className="bg-gray-800" value="Approved">Approved</option>
                  <option className="bg-gray-800" value="Completed">Completed</option>
                </>
              )}
            </select>
          </div>

          {userRole === 'admin' && (
            <>
              <div className="hidden lg:block h-6 w-px bg-gray-700 ml-2"></div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-semibold tracking-widest uppercase mb-1">Assignee</label>
                <select value={task.assignee_id || ''} onChange={(e) => updateTaskField('assignee_id', e.target.value || null)} className="text-sm bg-transparent border-none text-white focus:ring-0 cursor-pointer p-0 w-32 md:w-40">
                  <option className="bg-gray-800 text-gray-400" value="">Unassigned</option>
                  {committeeMembers.map(member => (
                    <option className="bg-gray-800" key={member.id} value={member.id}>{member.email}</option>
                  ))}
                </select>
              </div>

              <div className="hidden lg:block h-6 w-px bg-gray-700"></div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-semibold tracking-widest uppercase mb-1">Deadline</label>
                <input type="date" value={task.pr_date || ''} onChange={(e) => updateTaskField('pr_date', e.target.value || null)} className="text-sm bg-transparent border-none text-red-400 focus:ring-0 cursor-pointer p-0"/>
              </div>
            </>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 lg:gap-3 items-center w-full lg:w-auto lg:ml-auto">
          {userRole === 'admin' && (
             <button onClick={handleDelete} title="Delete Task" className="p-2 text-red-400 hover:bg-red-500/10 rounded-md transition border border-transparent hover:border-red-500/20 mr-0 lg:mr-2"><Trash2 size={18} /></button>
          )}
          
          <button onClick={handlePolish} disabled={isProcessing} className="flex-1 lg:flex-none justify-center flex items-center gap-2 bg-purple-600/20 text-purple-400 px-3 md:px-4 py-2 rounded-md hover:bg-purple-600/30 transition disabled:opacity-50 text-sm md:text-base">
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} AI Polish
          </button>
          <button onClick={handleSave} disabled={isProcessing} className="flex items-center gap-2 bg-gray-800 text-white px-3 md:px-4 py-2 rounded-md hover:bg-gray-700 text-sm md:text-base"><Save size={16} /> Save</button>

          {userRole === 'editor' && task.status === 'Drafting' && (
            <button onClick={handleSendForReview} disabled={isProcessing} className="w-full lg:w-auto flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold mt-2 lg:mt-0 text-sm md:text-base"><Send size={16} /> Send for Review</button>
          )}
          {userRole === 'editor' && task.status === 'Review' && (
            <button onClick={handleSendForReview} disabled={isProcessing} className="w-full lg:w-auto flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold mt-2 lg:mt-0 text-sm md:text-base"><Send size={16} /> Submit Edits</button>
          )}
          {userRole === 'admin' && task.status === 'Review' && (
            <button onClick={handleApproveTask} disabled={isProcessing} className="w-full lg:w-auto flex justify-center items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold mt-2 lg:mt-0 text-sm md:text-base"><CheckCircle size={16} /> Approve</button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-4 px-1 md:px-2 gap-4">
         <h1 className="text-2xl md:text-3xl font-bold w-full lg:w-auto truncate">{task.title}</h1>
         
         {/* PANEL TOGGLES */}
         <div className="flex bg-gray-800 p-1 rounded-lg w-full lg:w-auto overflow-x-auto">
            <button onClick={() => setActivePanel('whatsapp')} className={`flex-1 lg:flex-none justify-center px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition flex items-center gap-2 ${activePanel === 'whatsapp' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}><Smartphone size={14} className="md:w-4 md:h-4"/> Preview</button>
            <button onClick={() => setActivePanel('comments')} className={`flex-1 lg:flex-none justify-center px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition flex items-center gap-2 ${activePanel === 'comments' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}><MessageSquare size={14} className="md:w-4 md:h-4"/> Comments</button>
            <button onClick={() => setActivePanel('history')} className={`flex-1 lg:flex-none justify-center px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition flex items-center gap-2 ${activePanel === 'history' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}><History size={14} className="md:w-4 md:h-4"/> History</button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[700px]">
        
        {/* RICH TEXT EDITOR COLUMN */}
        <div className="flex flex-col gap-3 w-full h-[400px] lg:h-full relative">
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 p-2 rounded-xl shadow-sm overflow-x-auto">
            <button onClick={() => applyFormat('bold')} className="p-2 hover:bg-gray-800 rounded-md text-gray-300 transition shrink-0" title="Bold Selection"><Bold size={16}/></button>
            <button onClick={() => applyFormat('italic')} className="p-2 hover:bg-gray-800 rounded-md text-gray-300 transition shrink-0" title="Italicize Selection"><Italic size={16}/></button>
            <div className="w-px h-6 bg-gray-700 mx-1 shrink-0"></div>
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 hover:bg-gray-800 rounded-md text-gray-300 transition shrink-0" title="Insert Emoji"><Smile size={16}/></button>
          </div>

          {/* The picker is now safely outside the overflow container */}
          {showEmojiPicker && (
            <div className="absolute top-16 left-0 md:left-2 z-[100] shadow-2xl">
              <EmojiPicker onEmojiClick={(e) => handleEmoji(e.emoji)} theme={"dark" as any} height={400} width={320} />
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start drafting your PR caption here... Highlight text to Bold or Italicize it!"
            className="flex-1 p-4 md:p-6 bg-white dark:bg-[#121212] text-black dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-xl shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base md:text-lg leading-relaxed transition-colors w-full"
          />
        </div>

        {/* DYNAMIC PANEL */}
        <div className="h-[500px] lg:h-full bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden flex flex-col w-full">
          
          {activePanel === 'whatsapp' && (
            <>
              <div className="flex flex-wrap items-center justify-between p-3 md:p-4 bg-gray-800 border-b border-gray-700 gap-2 md:gap-4">
                <span className="text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-widest hidden md:inline">WhatsApp</span>
                <div className="flex gap-1 md:gap-2 flex-wrap w-full md:w-auto">
                  <div className="flex bg-gray-900 rounded-md p-1 border border-gray-700">
                    <button onClick={() => setWaDevice('mobile')} className={`p-1 md:p-1.5 rounded ${waDevice === 'mobile' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><Smartphone size={14}/></button>
                    <button onClick={() => setWaDevice('desktop')} className={`p-1 md:p-1.5 rounded ${waDevice === 'desktop' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><Monitor size={14}/></button>
                  </div>
                  <div className="flex bg-gray-900 rounded-md p-1 border border-gray-700">
                    <button onClick={() => setWaTheme('light')} className={`p-1 md:p-1.5 rounded ${waTheme === 'light' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><Sun size={14}/></button>
                    <button onClick={() => setWaTheme('dark')} className={`p-1 md:p-1.5 rounded ${waTheme === 'dark' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><Moon size={14}/></button>
                  </div>
                  <div className="flex bg-gray-900 rounded-md p-1 border border-gray-700 flex-1 md:flex-none justify-center">
                    <button onClick={() => setWaContext('group')} className={`p-1 md:p-1.5 rounded text-[10px] md:text-xs font-medium px-2 md:px-3 ${waContext === 'group' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Group</button>
                    <button onClick={() => setWaContext('community')} className={`p-1 md:p-1.5 rounded text-[10px] md:text-xs font-medium px-2 md:px-3 flex items-center gap-1 ${waContext === 'community' ? 'bg-green-600/20 text-green-400' : 'text-gray-500'}`}><Users size={10} className="md:w-3 md:h-3"/> Community</button>
                  </div>
                  <button onClick={() => setWaMedia(waMedia === 'image' ? 'text' : 'image')} className={`p-1 md:p-1.5 px-2 md:px-3 rounded-md border flex items-center gap-1 md:gap-2 text-[10px] md:text-xs font-medium transition flex-1 md:flex-none justify-center ${waMedia === 'image' ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-gray-900 border-gray-700 text-gray-400'}`}><ImageIcon size={12} className="md:w-3 md:h-3"/> {waMedia === 'image' ? 'With Image' : 'Text Only'}</button>
                </div>
              </div>

              <div className={`flex-1 flex justify-center items-start md:items-center p-2 md:p-4 ${waTheme === 'dark' ? 'bg-black' : 'bg-gray-200'} overflow-y-auto`}>
                <div className={`relative flex flex-col shadow-2xl transition-all duration-300 ease-in-out ${waDevice === 'mobile' ? 'w-full max-w-[360px] h-[550px] md:h-[640px] rounded-[1.5rem] md:rounded-[2rem] border-[6px] md:border-[8px] border-gray-900 overflow-hidden shrink-0 mt-4 md:mt-0' : 'w-full h-full rounded-lg overflow-hidden border border-gray-700'}`}>
                  <div className={`flex items-center px-3 md:px-4 py-2 md:py-3 z-10 ${waTheme === 'dark' ? 'bg-[#202c33] text-white' : 'bg-[#008069] text-white'}`}>
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-400 mr-2 md:mr-3 overflow-hidden flex items-center justify-center shrink-0"><Users size={16} className="md:w-5 md:h-5 text-white"/></div>
                    <div className="truncate"><div className="font-semibold text-sm md:text-base truncate">{waContext === 'community' ? 'Mora Xtreme Announcements' : 'Mora Xtreme OC 11.0'}</div><div className={`text-[10px] md:text-xs ${waTheme === 'dark' ? 'text-gray-400' : 'text-gray-200'}`}>tap here for group info</div></div>
                  </div>
                  <div className={`flex-1 p-2 md:p-4 overflow-y-auto ${waTheme === 'dark' ? 'bg-[#0b141a]' : 'bg-[#efeae2]'}`} style={{ backgroundImage: waTheme === 'light' ? 'url("https://web.whatsapp.com/img/bg-chat-tile-light_04fcacde539c58cca6745483d4858c52.png")' : 'none', opacity: 0.95 }}>
                    <div className={`w-[90%] md:max-w-[85%] rounded-lg shadow-sm overflow-hidden mb-4 ${waTheme === 'dark' ? 'bg-[#202c33] text-[#e9edef]' : 'bg-white text-[#111b21]'}`}>
                      {waMedia === 'image' && (
                         <div className="w-full aspect-[4/3] bg-gray-700 flex items-center justify-center p-1">
                           <div className="w-full h-full bg-gray-600 rounded flex flex-col items-center justify-center text-gray-400 gap-1 md:gap-2"><ImageIcon size={24} className="md:w-8 md:h-8" /><span className="text-[10px] md:text-xs font-medium">Poster Placeholder</span></div>
                         </div>
                      )}
                      <div className="p-2 px-3 pb-5 md:pb-6 relative">
                        {waContext === 'group' && <div className="text-xs md:text-[13px] font-semibold text-[#53bdeb] mb-1">~ Admin</div>}
                        {waContext === 'community' && <div className="text-xs md:text-[13px] font-semibold text-[#00a884] mb-1 flex items-center gap-1"><Users size={10} className="md:w-3 md:h-3"/> Community Admin</div>}
                        <div className="text-[13px] md:text-[14.2px] whitespace-pre-wrap leading-[18px] md:leading-[20px] font-[Segoe UI,Helvetica Neue,Helvetica,Arial,sans-serif]">{content || "Start typing..."}</div>
                        <span className={`absolute bottom-1 right-2 text-[9px] md:text-[11px] ${waTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>12:00 PM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activePanel === 'comments' && (
            <>
              <div className="p-3 md:p-4 border-b border-gray-800 font-semibold text-gray-300 flex items-center gap-2 bg-gray-800 text-sm md:text-base"><MessageSquare size={14} className="md:w-4 md:h-4"/> Discussion & Feedback</div>
              <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4">
                {comments.length === 0 ? <p className="text-gray-500 text-xs md:text-sm italic text-center mt-10">No comments yet.</p> : 
                  comments.map(c => (
                  <div key={c.id} className={`p-2 md:p-3 rounded-lg text-xs md:text-sm ${c.user_email === userEmail ? 'bg-blue-900/30 border border-blue-800/50 ml-4 md:ml-8' : 'bg-gray-800 border border-gray-700 mr-4 md:mr-8'}`}>
                    <div className="text-[10px] md:text-xs text-gray-500 mb-1">{c.user_email}</div>
                    <p className="text-gray-200">{c.content}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 md:p-4 border-t border-gray-800 bg-gray-900 flex gap-2">
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Type a comment..." className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 text-xs md:text-sm focus:outline-none focus:border-blue-500" />
                <button onClick={handleAddComment} className="bg-blue-600 p-2 rounded-md text-white hover:bg-blue-700"><Send size={14} className="md:w-4 md:h-4"/></button>
              </div>
            </>
          )}

          {activePanel === 'history' && (
            <>
              <div className="p-3 md:p-4 border-b border-gray-800 font-semibold text-gray-300 flex items-center gap-2 bg-gray-800 text-sm md:text-base"><History size={14} className="md:w-4 md:h-4"/> Snapshots</div>
              <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4">
                {versions.length === 0 ? <p className="text-gray-500 text-xs md:text-sm italic text-center mt-10">No history yet.</p> : 
                  versions.map((version) => (
                  <div key={version.id} className="bg-gray-800 p-2 md:p-3 rounded-lg border border-gray-700 shadow-sm">
                    <div className="flex justify-between items-center mb-1 md:mb-2">
                      <span className="text-[10px] md:text-xs text-gray-400">{new Date(version.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button onClick={() => { if(confirm("Restore this version?")) setContent(version.previous_content) }} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[10px] md:text-xs font-medium"><RotateCcw size={10} className="md:w-3 md:h-3" /> Restore</button>
                    </div>
                    <p className="text-xs md:text-sm text-gray-300 line-clamp-3 italic">"{version.previous_content}"</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}