import React, { useState, useRef, useEffect } from 'react'
import './App.css'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    parts: MessagePart[]
}

type MessagePart =
    | { type: 'text'; content: string }
    | { type: 'tool-invocation'; toolInvocation: ToolInvocation }

interface ToolInvocation {
    toolCallId: string
    toolName: string
    args: any
    result?: any
}

interface Thread {
    id: string
    title: string
    createdAt: string
    updatedAt: string
}

const ToolStatus = ({ tool }: { tool: ToolInvocation }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const isFinished = !!tool.result

    let friendlyName = tool.toolName
    let statusMessage = isFinished ? '完了' : '実行中...'
    let thinkingText = ''

    if (tool.toolName === 'knowledgeTool') {
        friendlyName = '村の知識'
        statusMessage = isFinished ? '思い出しました！' : '思い出しています・・・'

        if (isFinished && tool.result) {
            try {
                const resultObj = typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
                const text = resultObj?.results?.[0]?.text || ''
                const headers = text.match(/^##\s+(.+)$/gm)?.map((h: string) => h.replace(/^##\s+/, '')) || []

                if (headers.length > 0) {
                    const items = headers.slice(0, 3).join('や')
                    thinkingText = `そうだ、${items}${headers.length > 3 ? 'など' : ''}があったんだよね・・・`
                } else {
                    const query = tool.args?.query || 'これ'
                    thinkingText = `そうだ、${query}についてのことだよね・・・`
                }
            } catch (e) {
                thinkingText = '（内容を整理中・・・）'
            }
        }
    } else if (tool.toolName === 'devTool') {
        friendlyName = 'デバッグモード'
        statusMessage = isFinished ? '完了' : '起動中...'
    } else if (tool.toolName === 'masterTool') {
        friendlyName = '管理者モード'
        statusMessage = isFinished ? '認証完了' : '認証中...'
    }

    const headerText = `${friendlyName}を${statusMessage}`

    return (
        <div className="my-2 text-left">
            <div
                className="cursor-pointer text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span>{isExpanded ? '▼' : '▶'}</span>
                <span>{headerText}</span>
            </div>
            {isExpanded && (
                <div className="mt-2 bg-gray-50 p-3 rounded-lg text-sm">
                    {thinkingText && (
                        <div className="text-black font-medium mb-2">
                            {thinkingText}
                        </div>
                    )}
                    <div className="text-gray-400 text-xs font-bold mb-1">ツール: {tool.toolName}</div>
                    <div className="text-gray-400 text-xs mb-2 font-mono break-all">入力: {JSON.stringify(tool.args)}</div>
                    {tool.result && (
                        <div className="pt-2 border-t border-gray-200 text-gray-400 text-xs font-mono break-all">
                            結果: {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result)}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function App() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [threads, setThreads] = useState<Thread[]>([])
    const [threadId, setThreadId] = useState(() => `thread-${Date.now()}`)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        loadThreads()
    }, [])

    const loadThreads = async () => {
        try {
            const res = await fetch('/api/threads/default-user')
            if (res.ok) {
                const data = await res.json()
                // Sort by updatedAt desc
                data.sort((a: Thread, b: Thread) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                setThreads(data)
            }
        } catch (e) {
            console.error('Failed to load threads', e)
        }
    }

    const loadThread = async (id: string) => {
        if (isLoading) return
        setThreadId(id)
        setMessages([])
        setIsLoading(true)
        try {
            const res = await fetch(`/api/threads/${id}/messages`)
            if (res.ok) {
                const data = await res.json()
                // Map UI messages to our Message format if needed
                // Assuming data is compatible or we map it
                // Mastra uiMessages might differ slightly, let's inspect or map safely
                const mappedMessages = data.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    parts: m.parts || (m.content ? [{ type: 'text', content: m.content }] : [])
                }))
                setMessages(mappedMessages)
            }
        } catch (e) {
            console.error('Failed to load messages', e)
            setErrorMsg('メッセージの読み込みに失敗しました')
        } finally {
            setIsLoading(false)
        }
    }

    const createNewChat = () => {
        if (isLoading) return
        const newId = `thread-${Date.now()}`
        setThreadId(newId)
        setMessages([])
        setInput('')
        setErrorMsg(null)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            parts: [{ type: 'text', content: input }]
        }

        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsLoading(true)
        setErrorMsg(null)

        try {
            const assistantMsgId = Date.now().toString() + '-assistant'
            const initialAssistantMsg: Message = {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                parts: []
            }

            setMessages(prev => [...prev, initialAssistantMsg])

            const response = await fetch('/api/agents/Nep-chan/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    threadId
                }),
            })

            if (!response.ok) throw new Error(response.statusText)
            if (!response.body) throw new Error('No response body')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6)
                        if (jsonStr === '[DONE]') continue

                        try {
                            const data = JSON.parse(jsonStr)
                            handleStreamEvent(data, assistantMsgId)
                        } catch (e) {
                            console.error('Error parsing JSON:', e)
                        }
                    }
                }
            }

            // Refresh threads list after message is sent (to update title/timestamp)
            loadThreads()

        } catch (error: any) {
            console.error('Chat error:', error)
            setErrorMsg(error.message || 'An error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    const handleStreamEvent = (data: any, msgId: string) => {
        setMessages(prev => {
            const newMessages = [...prev]
            const msgIndex = newMessages.findIndex(m => m.id === msgId)
            if (msgIndex === -1) return prev

            const msg = { ...newMessages[msgIndex] }
            const parts = [...(msg.parts || [])]

            if (data.type === 'text-delta') {
                msg.content += data.delta

                const lastPart = parts[parts.length - 1]
                if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { ...lastPart, content: lastPart.content + data.delta }
                } else {
                    parts.push({ type: 'text', content: data.delta })
                }
            } else if (data.type === 'tool-input-available') {
                const toolInvocation: ToolInvocation = {
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    args: data.input
                }
                parts.push({ type: 'tool-invocation', toolInvocation })
            } else if (data.type === 'tool-output-available') {
                const partIndex = parts.findIndex(p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === data.toolCallId)
                if (partIndex !== -1) {
                    const part = parts[partIndex] as { type: 'tool-invocation', toolInvocation: ToolInvocation }
                    parts[partIndex] = {
                        ...part,
                        toolInvocation: {
                            ...part.toolInvocation,
                            result: data.output
                        }
                    }
                }
            }

            msg.parts = parts
            newMessages[msgIndex] = msg
            return newMessages
        })
    }

    return (
        <div className="flex h-screen bg-white">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h1 className="font-bold text-lg">ネップちゃん 🦊</h1>
                    <p className="text-xs text-gray-500">音威子府村コンパニオンAI</p>
                </div>

                <div className="p-2">
                    <button
                        onClick={createNewChat}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <span>+</span> 新しいチャット
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {threads.map(thread => (
                        <div
                            key={thread.id}
                            onClick={() => loadThread(thread.id)}
                            className={`p-3 rounded-lg cursor-pointer text-sm transition-colors ${thread.id === threadId
                                    ? 'bg-gray-100 text-black font-medium'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="truncate">{thread.title || '無題の会話'}</div>
                            <div className="text-xs text-gray-400 mt-1">
                                {new Date(thread.updatedAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                    {threads.length === 0 && (
                        <div className="text-sm text-gray-400 text-center mt-4">
                            履歴はありません
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full bg-white">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user'
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'bg-white text-gray-900'
                                    }`}
                            >
                                {msg.parts && msg.parts.length > 0 ? (
                                    msg.parts.map((part, index) => {
                                        if (part.type === 'text') {
                                            return <div key={index} className="whitespace-pre-wrap">{part.content}</div>
                                        }
                                        if (part.type === 'tool-invocation') {
                                            return (
                                                <div key={index} className="my-2">
                                                    <ToolStatus tool={part.toolInvocation} />
                                                </div>
                                            )
                                        }
                                        return null
                                    })
                                ) : (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && !messages[messages.length - 1]?.content && (
                        <div className="flex justify-start">
                            <div className="bg-white text-gray-500 px-4 py-2">
                                <span className="animate-pulse">...</span>
                            </div>
                        </div>
                    )}
                    {errorMsg && (
                        <div className="flex justify-center">
                            <div className="bg-red-50 text-red-500 text-sm px-4 py-2 rounded-lg">
                                {errorMsg}
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-100 bg-white">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                            placeholder="メッセージを入力..."
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-200"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-black text-white px-6 py-2 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            送信
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default App
