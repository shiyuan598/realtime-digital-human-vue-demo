<template>
  <div>
    <div v-if="showHuman" class="iframe-wrapper">
      <iframe id="digital-human-iframe" :src="iframeSrc" :style="iframeStyle" allow="autoplay"></iframe>
      <div v-if="videoIsMuted" class="tip1" @click="cancelMuted">取消静音</div>
      <div v-if="showTimeoutTip" class="tip2" @click="playWelcome">
        长时间无交互，数字人马上消失了，点我一下，进行交互
      </div>
    </div>
    <div class="button-wrapper">
      <button @click="playWelcome">文本播报</button>
      <button @click="playStreamText">流式文本播报</button>
      <button @click="playAudio">音频播报</button>
      <button @click="playStreamAudio">流式音频播报</button>
      <button @click="handleInterrupt">打断播报</button>
      <button @click="handleMountHuman">重载数字人</button>
      <button @click="handleUnmountHuman">卸载数字人</button>
    </div>
  </div>
</template>

<script>
import { onMounted, ref, watch } from "vue";
import { v4 as uuidV4 } from "uuid";

import DHIframe from "@bddh/starling-dhiframe";
import useAudioRender from "./hooks/useAudioRender"; // 引入自定义 hook

const dhIframe = new DHIframe("digital-human-iframe");

const ReadyState = {
  UNINSTANTIATED: -1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const checkPlayUnMute = () => {
  return new Promise((resolve) => {
    const audioElem = document.createElement("audio");
    // eslint-disable-next-line max-len
    audioElem.src =
      "data:audio/wav;base64,UklGRp4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAATElTVBoAAABJTkZPSVNGVA0AAABMYXZmNjEuNy4xMDAAAGRhdGFYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
    audioElem.muted = false;

    const playPromise = audioElem.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // 自动播放成功
          resolve(true);
        })
        .catch((error) => {
          if (error.name === "NotAllowedError" || error.name === "AbortError") {
            // 自动播放被禁止或中止
            resolve(false);
          } else {
            // 其他错误
            resolve(false);
          }
        });
      // 防止playPromise为空对象，没有finially的情况
      setTimeout(() => {
        audioElem.remove();
        resolve(true);
      }, 300);
    } else {
      // 如果 play() 返回 undefined，可能是浏览器不支持 Promise 风格的 play()
      audioElem.remove();
      resolve(false);
    }
  });
};

export default {
  name: "App",
  setup() {
    const realTimeVideoReady = ref(false);
    const wsConnected = ref(false);
    const videoIsMuted = ref(false);
    const commandId = ref(uuidV4());
    const checkOver = ref(false);
    const showTimeoutTip = ref(false);
    const showLoadingPage = ref(false);
    const showHuman = ref(true);

    const { playAudio, playStreamAudio } = useAudioRender(dhIframe);
    const figure2D = "A2A_V2-xixi";
    const figure3D = "A2A_V2-fig-rd4mkz79idnhydu0";
    const url = "https://open.xiling.baidu.com/cloud/realtime";
    const token = "i-repjnpaq2g1j7/d4317ddf74acd4564f12679751fc57f0510a1ce3cfdb98d773daf20ec14f9687/2025-05-21T05:36:05.342Z";
    const iframeSrc = ref(`${url}?cp-autoAnimoji=true&mode=crop&textAssist=false&autoChromaKey=true&initMode=noAudio&cameraId=3&figureId=${figure3D}&token=${token}`);

    const onMessage = (msg) => {
      if (msg.origin === "https://open.xiling.baidu.com") {
        const { type, content } = msg.data;
        switch (type) {
          case "rtcState":
            if (content.action === "remoteVideoConnected") {
              realTimeVideoReady.value = true;
            }
            if (content.action === "localVideoMuted" && content.body) {
              videoIsMuted.value = true;
            }
            break;
          case "wsState":
            if (content.readyState === ReadyState.OPEN) {
              wsConnected.value = true;
            } else if (content.readyState === ReadyState.CLOSED || content.readyState === ReadyState.CLOSING) {
              wsConnected.value = false;
            }
            break;
          case "msg":
            const { action, requestId } = content;
            if (requestId === commandId.value && action === "FINISHED") {
              console.info(`数字人驱动完成, 驱动id为${requestId}`);
              const newCommandId = uuidV4();
              // 解开注释可以进行持续播报
              // commandId.value = newCommandId;
              dhIframe.sendMessage({
                action: "TEXT_RENDER",
                body: "我已经完成一次驱动，这是我说的第n句话",
                requestId: newCommandId,
              });
            } else if (action === "DISCONNECT_ALERT") {
              showTimeoutTip.value = true;
            } else if (action === "TIMEOUT_EXIT") {
              const iframeDom = document.getElementById("digital-human-iframe");
              iframeDom?.remove();
            }
            break;
          default:
            break;
        }
      }
    };

    const cancelMuted = () => {
      // 如果无用户交互，再引导用户完成点击交互后，需要发送该指令取消video静音
      if (videoIsMuted.value) {
        dhIframe.sendCommand({
          subType: "muteAudio",
          subContent: false,
        });
      }
      // sendCommand是异步的，建议等待1-2s后再进行文本驱动。
      setTimeout(() => {
        videoIsMuted.value = false;
      }, 1500);
    };

    const playWelcome = () => {
      dhIframe.sendMessage({
        action: "TEXT_RENDER",
        body: "这是我的开场白自我介绍，我是数字人",
        requestId: commandId.value,
      });
    };

    const playStreamText = () => {
      // 一轮流式驱动requestId必须使用同一个
      dhIframe.sendMessage({
        action: "TEXT_STREAM_RENDER",
        body: JSON.stringify({
          first: true,
          last: false,
          text: "你好啊，我是",
        }),
        requestId: commandId.value,
      });

      dhIframe.sendMessage({
        action: "TEXT_STREAM_RENDER",
        body: JSON.stringify({
          first: false,
          last: false,
          text: "数字人",
        }),
        requestId: commandId.value,
      });

      dhIframe.sendMessage({
        action: "TEXT_STREAM_RENDER",
        body: JSON.stringify({
          first: false,
          last: false,
          text: "分身",
        }),
        requestId: commandId.value,
      });

      setTimeout(() => {
        dhIframe.sendMessage({
          action: "TEXT_STREAM_RENDER",
          body: JSON.stringify({
            first: false,
            last: false,
            text: "今天天气",
          }),
          requestId: commandId.value,
        });

        dhIframe.sendMessage({
          action: "TEXT_STREAM_RENDER",
          body: JSON.stringify({
            first: false,
            last: true,
            text: "很好",
          }),
          requestId: commandId.value,
        });
      }, 500);
    };

    const handleInterrupt = () => {
      dhIframe.sendMessage({
        action: "TEXT_RENDER",
        body: "<interrupt></interrupt>",
        requestId: commandId.value,
      });
    };

    const handleMountHuman = () => {
      showHuman.value = true;
    };

    const handleUnmountHuman = () => {
      showHuman.value = false;
    };

    const goNextPage = () => {
      showLoadingPage.value = false;
      videoIsMuted.value = false;
    };

    onMounted(async () => {
      const result = await checkPlayUnMute(); // 500ms左右
      console.log("result", result);
      videoIsMuted.value = !result;
      checkOver.value = true;

      dhIframe.registerMessageReceived(onMessage);
      return () => {
        dhIframe.removeMessageReceived(onMessage);
      };
    });

    watch(
      [realTimeVideoReady, wsConnected, checkOver, videoIsMuted],
      ([newRealTimeVideoReady, newWsConnected, newCheckOver, newVideoIsMuted]) => {
        console.log("checkOver", newCheckOver, "videoIsMuted", newVideoIsMuted);
        if (newRealTimeVideoReady && newWsConnected && newCheckOver && !newVideoIsMuted) {
          dhIframe.sendMessage({
            action: "TEXT_RENDER",
            body: "这是我的开场白自我介绍，我是数字人",
            requestId: commandId.value,
          });
        }
      }
    );

    return {
      realTimeVideoReady,
      wsConnected,
      videoIsMuted,
      showHuman,
      commandId,
      checkOver,
      showTimeoutTip,
      showLoadingPage,
      playWelcome,
      cancelMuted,
      playAudio,
      playStreamAudio,
      playStreamText,
      handleInterrupt,
      goNextPage,
      handleMountHuman,
      handleUnmountHuman,
      iframeSrc,
    };
  },
};
</script>

<style scoped>
.button-wrapper {
  width: 30%;
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  position: absolute;
  top: 10px;
  left: 10px;
  flex-wrap: wrap;
}

.iframe-wrapper {
  position: absolute;
  width: 450px;
  height: 800px;
  top: 1vw;
  right: 4vw;
  overflow: hidden;
  text-align: start;
  transform: scale(0.8);
}

#digital-human-iframe {
  position: absolute;
  width: 100%;
  height: 100%;
  border: none;
}

.tip1 {
  position: absolute;
  color: red;
  left: 0;
  cursor: pointer;
  top: 0;
  height: 100%;
  width: 100%;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;  
}

.tip2 {
  position: absolute;
  left: 50%;
  cursor: pointer;
  top: 25%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;  
}
</style>
