import {v4 as uuidV4} from 'uuid';

import {arrayBufferToBase64, concatenatePCM} from "../utils/audioUtils";

export async function fetchData(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, {
        method: 'GET'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // 将响应体解析为 ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
}

const waitStop = async (time: number) => {
    return new Promise<void>(resolve => {
        setTimeout(() => resolve(), time || 100);
    });
};

export default function useAudioRender(dhIframe: any) {

    // 单独抽取一个函数用于获取 PCM 数据
    const fetchPCM = async (url: RequestInfo | URL) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.arrayBuffer();
    };

    const sendAudio = (arrayBuffer: ArrayBuffer) => {
        const base64String = arrayBufferToBase64(arrayBuffer); // pcm转base64
        dhIframe.sendAudioData({
            action: 'AUDIO_RENDER',
            body: base64String,
            requestId: uuidV4()
        })
    };

    const playAudio = async () => {
        // 获取本地的 PCM 文件数据
        try {
            const arrayBuffer1 = await fetchPCM('test.pcm');
            // 播放音频并发送数据
            sendAudio(arrayBuffer1);
        } catch (error) {
            console.error('There has been a problem with your fetch operation:', error);
        }
    };
    const playMultiAudio = async () => {
        try {
            // 使用 Promise.all 并行获取两个音频片段
            const [arrayBuffer1, arrayBuffer2] = await Promise.all([
                fetchPCM('test.pcm'),
                fetchPCM('test.pcm')
            ]);
            // 拼接音频数据
            const concatenatedBuffer = concatenatePCM(arrayBuffer1, arrayBuffer2, 16);
            // 播放音频并发送数据
            // playPCM(concatenatedBuffer, 16, 1); // 前端test
            sendAudio(concatenatedBuffer);
        } catch (error) {
            console.error('There has been a problem with your fetch operation:', error);
        }
    };

    const playStreamAudio = async () => {
        const buffer = await fetchData('16k.pcm');
        const unitLen = 2048; // 模拟切段
        const len = Math.ceil(buffer.byteLength / unitLen);
        const requestId = uuidV4();
        for (let i = 0; i < len; ++i) {
            const arrayBuffer = buffer.slice(i * unitLen, (i + 1) * unitLen);
            const base64String = arrayBufferToBase64(arrayBuffer); // pcm转base64
            if (i % 10 === 0) {
                await waitStop(50);
            }
            dhIframe.sendAudioData({
                action: 'AUDIO_STREAM_RENDER',
                requestId,
                body: JSON.stringify({
                    audio: base64String,
                    first: i === 0,
                    last: i === len - 1,
                }),
            })
        }
    };

    return {
        playAudio,
        playMultiAudio,
        playStreamAudio
    };
}
