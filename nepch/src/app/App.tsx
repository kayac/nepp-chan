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

const ToolStatus = ({ tool, isDevMode }: { tool: ToolInvocation, isDevMode: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const isFinished = !!tool.result

    let friendlyName = tool.toolName
    let statusMessage = isFinished ? '完了' : '実行中...'
    let thinkingText = ''

    // Hide internal tools from the UI unless in dev mode
    // if (!isDevMode && (tool.toolName === 'persona-tool' || tool.toolName === 'news-tool')) {
    //     return null
    // }

    if (tool.toolName === 'persona-tool') {
        friendlyName = '記憶'
        if (tool.args?.action === 'save') {
            statusMessage = isFinished ? '覚えました' : '覚えています...'
        } else {
            statusMessage = isFinished ? '思い出しました' : '思い出しています...'
        }
    } else if (tool.toolName === 'news-tool') {
        friendlyName = '村の様子'
        if (tool.args?.action === 'add') {
            statusMessage = isFinished ? 'メモしました' : 'メモしています...'
        } else {
            statusMessage = isFinished ? '確認しました' : '確認しています...'
        }
    } else if (tool.toolName === 'knowledgeTool') {
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
    } else if (tool.toolName === 'searchTool') {
        friendlyName = 'Web検索'
        statusMessage = isFinished ? '完了' : '調べています...'

        if (isFinished && tool.result) {
            const query = tool.args?.query || 'これ'
            thinkingText = `そうだ、${query}について調べてみたよ・・・`
        }
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
    const [isDevMode, setIsDevMode] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        loadThreads()
    }, [])

    useEffect(() => {
        if (!isLoading) {
            setTimeout(() => inputRef.current?.focus(), 10)
        }
    }, [isLoading])

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
        setIsDevMode(false) // Reset dev mode on thread switch
        setIsLoading(true)
        try {
            console.log(`Loading thread ${id}...`)
            const res = await fetch(`/api/threads/${id}/messages`)
            if (res.ok) {
                const data = await res.json()
                console.log('Loaded messages:', data)

                // Check for devTool usage in history
                let hasDevTool = false
                const mappedMessages = data.map((m: any) => {
                    const parts = m.parts
                        ? m.parts.map((p: any) => {
                            if (p.type === 'tool-invocation' && p.toolInvocation.toolName === 'devTool') {
                                hasDevTool = true
                            }
                            return {
                                ...p,
                                content: p.content || p.text
                            }
                        })
                        : (m.content ? [{ type: 'text', content: m.content }] : [])

                    return {
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        parts: parts
                    }
                })

                if (hasDevTool) {
                    setIsDevMode(true)
                }

                setMessages(mappedMessages)
            } else {
                console.error('Failed to fetch messages:', res.status, res.statusText)
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
        setIsDevMode(false)
        setTimeout(() => inputRef.current?.focus(), 10)
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

            if (!response.ok) {
                if (response.status === 429) {
                    const errorData = await response.json()
                    const retryAfter = errorData.retryAfter ? Math.ceil(parseFloat(errorData.retryAfter)) : null

                    let msg = retryAfter
                        ? `利用制限中です。あと${retryAfter}秒で解除されます。`
                        : '利用制限中です。しばらく待ってから再試行してください。'

                    if (errorData.error && errorData.error.includes('Gemini API')) {
                        msg = retryAfter
                            ? `Gemini APIの制限（1日1500回）を超えちゃったみたい。あと${retryAfter}秒で解除されるよ。`
                            : 'Gemini APIの制限（1日1500回）を超えちゃったみたい。しばらく待ってからまた話しかけてね。'
                    }

                    throw new Error(msg)
                }
                throw new Error(response.statusText)
            }
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
            // setErrorMsg(error.message || 'An error occurred')

            const errorMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: error.message || 'エラーが発生しました',
                parts: [{ type: 'text', content: error.message || 'エラーが発生しました' }]
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }

    const handleStreamEvent = (data: any, msgId: string) => {
        if (data.type === 'tool-input-available' && data.toolName === 'devTool') {
            setIsDevMode(true)
        }

        setMessages(prev => {
            const newMessages = [...prev]
            const msgIndex = newMessages.findIndex(m => m.id === msgId)
            if (msgIndex === -1) return prev

            const msg = { ...newMessages[msgIndex] }
            const parts = [...(msg.parts || [])]

            if (data.type === 'text-delta') {
                const cleanDelta = data.delta.replace(/більш/g, '')
                msg.content += cleanDelta

                const lastPart = parts[parts.length - 1]
                if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { ...lastPart, content: lastPart.content + cleanDelta }
                } else {
                    parts.push({ type: 'text', content: cleanDelta })
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
            } else if (data.type === 'error') {
                let errorText = data.errorText || 'エラーが発生しました'

                // Handle Rate Limit
                // Handle Rate Limit
                if (errorText.includes('Quota exceeded') || errorText.includes('429') || errorText.includes('Rate limit exceeded')) {
                    const match = errorText.match(/Please retry in ([0-9.]+)s/)
                    const retryAfter = match ? Math.ceil(parseFloat(match[1])) : null

                    if (errorText.includes('Gemini API')) {
                        errorText = retryAfter
                            ? `Gemini APIの制限（1日1500回）を超えちゃったみたい。あと${retryAfter}秒で解除されるよ。`
                            : 'Gemini APIの制限（1日1500回）を超えちゃったみたい。しばらく待ってからまた話しかけてね。'
                    } else {
                        errorText = retryAfter
                            ? `利用制限中です。あと${retryAfter}秒で解除されます。`
                            : '利用制限中です。しばらく待ってから再試行してください。'
                    }
                }

                const lastPart = parts[parts.length - 1]
                if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { ...lastPart, content: lastPart.content + '\n\n' + errorText }
                } else {
                    parts.push({ type: 'text', content: errorText })
                }
                msg.content += '\n\n' + errorText
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
            <div className="flex-1 flex flex-col w-full bg-white">
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto p-4 space-y-4">
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
                                                        <ToolStatus tool={part.toolInvocation} isDevMode={isDevMode} />
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
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-100 bg-white">
                    <div className="max-w-3xl mx-auto p-4">
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <input
                                ref={inputRef}
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
        </div>
    )
}

export default App
