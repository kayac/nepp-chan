import React, { useState, useRef } from 'react'
import './App.css'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    parts: MessagePart[]
}

type MessagePart =
    | { type: 'text'; content: string }
    | { type: 'tool'; toolInvocation: ToolInvocation }

interface ToolInvocation {
    toolCallId: string
    toolName: string
    args: any
    result?: any
}

function App() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

    // Ref to keep track of current message being streamed
    const currentMessageRef = useRef<Message | null>(null)

    const toggleTool = (toolCallId: string) => {
        setExpandedTools(prev => ({
            ...prev,
            [toolCallId]: !prev[toolCallId]
        }))
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
            const response = await fetch('/api/agents/Nep-chan/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
                })
            })

            if (!response.ok) throw new Error(response.statusText)
            if (!response.body) throw new Error('No response body')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            // Create a placeholder for the assistant message
            const assistantMsgId = Date.now().toString() + '-assistant'
            const initialAssistantMsg: Message = {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                parts: []
            }

            setMessages(prev => [...prev, initialAssistantMsg])
            currentMessageRef.current = initialAssistantMsg

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
        } catch (error: any) {
            console.error('Chat error:', error)
            setErrorMsg(error.message || 'An error occurred')
        } finally {
            setIsLoading(false)
            currentMessageRef.current = null
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

                // Check if the last part is text
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
                parts.push({ type: 'tool', toolInvocation })
            } else if (data.type === 'tool-output-available') {
                // Find the tool part to update
                const partIndex = parts.findIndex(p => p.type === 'tool' && p.toolInvocation.toolCallId === data.toolCallId)
                if (partIndex !== -1) {
                    const part = parts[partIndex] as { type: 'tool', toolInvocation: ToolInvocation }
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
        <div className="app-container">
            <header>
                <h1>ネップちゃん 🦊</h1>
            </header>
            <main>
                <div className="chat-container">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message ${msg.role}`}>
                            {msg.parts.map((part, index) => {
                                if (part.type === 'text') {
                                    return (
                                        <div key={index} className="message-content">
                                            {part.content}
                                        </div>
                                    )
                                } else {
                                    const toolInvocation = part.toolInvocation
                                    const toolCallId = toolInvocation.toolCallId
                                    const isExpanded = expandedTools[toolCallId]
                                    const isFinished = !!toolInvocation.result

                                    // Tool-specific display logic
                                    let friendlyName = toolInvocation.toolName
                                    let statusMessage = isFinished ? '完了' : '実行中...'
                                    let thinkingText = ''

                                    if (toolInvocation.toolName === 'knowledgeTool') {
                                        friendlyName = '村の知識'
                                        statusMessage = isFinished ? '思い出しました！' : '思い出しています・・・'

                                        if (isFinished && toolInvocation.result) {
                                            try {
                                                const resultObj = typeof toolInvocation.result === 'string' ? JSON.parse(toolInvocation.result) : toolInvocation.result
                                                const text = resultObj?.results?.[0]?.text || ''
                                                const headers = text.match(/^##\s+(.+)$/gm)?.map((h: string) => h.replace(/^##\s+/, '')) || []

                                                if (headers.length > 0) {
                                                    const items = headers.slice(0, 3).join('や')
                                                    thinkingText = `そうだ、${items}${headers.length > 3 ? 'など' : ''}があったんだよね・・・`
                                                } else {
                                                    const query = toolInvocation.args?.query || 'これ'
                                                    thinkingText = `そうだ、${query}についてのことだよね・・・`
                                                }
                                            } catch (e) {
                                                thinkingText = '（内容を整理中・・・）'
                                            }
                                        }
                                    } else if (toolInvocation.toolName === 'devTool') {
                                        friendlyName = 'デバッグモード'
                                        statusMessage = isFinished ? '完了' : '起動中...'
                                    } else if (toolInvocation.toolName === 'masterTool') {
                                        friendlyName = '管理者モード'
                                        statusMessage = isFinished ? '認証完了' : '認証中...'
                                    }

                                    const headerText = `${friendlyName}を${statusMessage}`

                                    return (
                                        <div key={toolCallId} className="tool-invocation-container" style={{ margin: '0.5rem 0', textAlign: 'left' }}>
                                            <div
                                                className="tool-header"
                                                onClick={() => toggleTool(toolCallId)}
                                                style={{ cursor: 'pointer', color: '#666', fontSize: '0.9rem' }}
                                            >
                                                {isExpanded ? `▼ ${headerText}` : `▶ ${headerText}`}
                                            </div>
                                            {isExpanded && (
                                                <div className="tool-details" style={{ backgroundColor: '#f9f9f9', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                                    {thinkingText && (
                                                        <div className="thinking-text" style={{ color: 'black', marginBottom: '0.5rem', fontWeight: 500 }}>
                                                            {thinkingText}
                                                        </div>
                                                    )}
                                                    <div className="tool-name" style={{ fontWeight: 'bold', color: '#999' }}>ツール: {toolInvocation.toolName}</div>
                                                    <div className="tool-args" style={{ color: '#999' }}>入力: {JSON.stringify(toolInvocation.args)}</div>
                                                    {toolInvocation.result && (
                                                        <div className="tool-result" style={{ marginTop: '0.5rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem', color: '#999' }}>
                                                            結果: {JSON.stringify(toolInvocation.result)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                }
                            })}
                        </div>
                    ))}
                    {isLoading && <div className="loading">...</div>}
                    {errorMsg && <div className="error" style={{ color: 'red' }}>{errorMsg}</div>}
                </div>
            </main>
            <footer>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        placeholder="ネップちゃんに話しかけてね"
                    />
                    <button type="submit" disabled={isLoading}>送信</button>
                </form>
            </footer>
        </div>
    )
}

export default App
