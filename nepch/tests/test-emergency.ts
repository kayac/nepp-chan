
import { emergencyReport } from '../src/mastra/tools/emergency-report';

async function testEmergencyReport() {
    console.log('Testing emergency-report tool...');

    const result = await emergencyReport.execute({
        context: {
            type: 'DANGER',
            content: '駅前にヒグマが出没しました！',
            location: '音威子府駅前'
        },
        mastra: {} as any
    });

    console.log('Result:', result);

    if (result.success && result.message.includes('緊急情報を記録')) {
        console.log('✅ SUCCESS: Emergency report logged.');
    } else {
        console.error('❌ FAILURE: Unexpected result.');
    }
}

testEmergencyReport();
