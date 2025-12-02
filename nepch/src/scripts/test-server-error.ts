
async function testServerError() {
    try {
        console.log('Testing Server Error Handling...');
        const response = await fetch('http://localhost:5173/api/agents/Nep-chan/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'こんにちは' }],
                threadId: 'test-thread'
            }),
        });

        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);

        if (response.status === 429) {
            const data = await response.json();
            console.log('Error Data:', JSON.stringify(data, null, 2));
        } else {
            const text = await response.text();
            console.log('Response Body:', text);
        }

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testServerError();
