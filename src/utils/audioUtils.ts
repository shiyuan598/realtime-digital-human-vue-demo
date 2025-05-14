
export function arrayBufferToBase64(buffer: any) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// 拼接两个 PCM 数据
export function concatenatePCM(buffer1: any, buffer2: any, bitDepth = 16) {
  let pcmData1, pcmData2;

  if (bitDepth === 8) {
    pcmData1 = new Uint8Array(buffer1);
    pcmData2 = new Uint8Array(buffer2);
  } else if (bitDepth === 16) {
    pcmData1 = new Int16Array(buffer1);
    pcmData2 = new Int16Array(buffer2);
  } else {
    throw new Error('Unsupported bit depth');
  }

  // 创建一个新的 TypedArray 来存储拼接后的 PCM 数据
  const concatenated = new (bitDepth === 8 ? Uint8Array : Int16Array)(pcmData1.length + pcmData2.length);

  // 将两个 TypedArray 数据拼接到一起
  concatenated.set(pcmData1, 0);
  concatenated.set(pcmData2, pcmData1.length);

  return concatenated.buffer; // 返回合并后的 ArrayBuffer
}

// 播放 PCM 音频
export const playPCM = (arrayBuffer: any, bitDepth = 16, numChannels = 1) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // 假设采样率为44.1kHz（可以根据实际文件修改）
  const sampleRate = 16000;

  let audioBuffer;
  if (bitDepth === 8) {
    const pcmData = new Uint8Array(arrayBuffer);
    const lengthPerChannel = pcmData.length / numChannels;

    // 创建 AudioBuffer
    audioBuffer = audioContext.createBuffer(numChannels, lengthPerChannel, sampleRate);

    // 将 PCM 数据拷贝到 AudioBuffer 中
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < lengthPerChannel; i++) {
        channelData[i] = (pcmData[i * numChannels + channel] - 128) / 128; // 8-bit PCM数据转换
      }
    }
  } else if (bitDepth === 16) {
    const pcmData = new Int16Array(arrayBuffer);
    const lengthPerChannel = pcmData.length / numChannels;

    // 创建 AudioBuffer
    audioBuffer = audioContext.createBuffer(numChannels, lengthPerChannel, sampleRate);

    // 将 PCM 数据拷贝到 AudioBuffer 中
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < lengthPerChannel; i++) {
        channelData[i] = pcmData[i * numChannels + channel] / 32768; // 16-bit PCM数据转换
      }
    }
  }

  // 创建 AudioBufferSourceNode 并播放
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);
};

