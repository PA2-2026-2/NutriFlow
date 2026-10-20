(function setupChatVoice(globalScope) {
  const MAX_RECORDING_SECONDS = 120;

  function createRecorder({ onRecordingChange, onRecording, onError }) {
    let recorder = null;
    let stream = null;
    let chunks = [];
    let startedAt = 0;
    let stopTimer = null;

    function stopTracks() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    async function stop() {
      if (recorder?.state === 'recording') {
        recorder.stop();
      }
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !globalScope.MediaRecorder) {
        onError('A gravação de áudio não é compatível com este navegador.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = typeof globalScope.MediaRecorder.isTypeSupported === 'function'
          ? ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
            .find((type) => globalScope.MediaRecorder.isTypeSupported(type))
          : '';
        recorder = new globalScope.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunks = [];
        startedAt = Date.now();
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size) chunks.push(event.data);
        });
        recorder.addEventListener('stop', async () => {
          globalScope.clearTimeout(stopTimer);
          stopTracks();
          onRecordingChange(false);
          const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000));
          if (durationSeconds > MAX_RECORDING_SECONDS) {
            onError(`A gravação pode ter no máximo ${MAX_RECORDING_SECONDS} segundos.`);
            return;
          }
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType });
            if (!blob.size || blob.size > 512 * 1024) {
              throw new Error('O áudio deve ter no máximo 512 KB.');
            }
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = '';
            bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
            await onRecording({
              audioBase64: globalScope.btoa(binary),
              audioMimeType: blob.type,
              audioDurationSeconds: durationSeconds,
            });
          } catch (error) {
            onError(error.message || 'Não foi possível preparar o áudio.');
          }
        }, { once: true });
        recorder.start();
        onRecordingChange(true);
        stopTimer = globalScope.setTimeout(() => void stop(), MAX_RECORDING_SECONDS * 1000);
      } catch (error) {
        stopTracks();
        onError(error.name === 'NotAllowedError'
          ? 'Permita o acesso ao microfone para gravar uma mensagem.'
          : 'Não foi possível acessar o microfone.');
      }
    }

    return {
      start,
      stop,
      get isRecording() {
        return recorder?.state === 'recording';
      },
    };
  }

  async function loadAudioPlayer(button, fetchAudio) {
    const messageId = button.dataset.audioMessageId;
    if (!messageId || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Carregando áudio...';
    try {
      const audio = await fetchAudio(messageId);
      const bytes = Uint8Array.from(globalScope.atob(audio.audioBase64), (char) => char.charCodeAt(0));
      const source = URL.createObjectURL(new Blob([bytes], { type: audio.audioMimeType }));
      const player = document.createElement('audio');
      player.controls = true;
      player.preload = 'none';
      player.src = source;
      player.className = 'mt-2 max-w-full';
      button.replaceWith(player);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Tentar reproduzir novamente';
      button.dataset.error = error.message || 'Não foi possível carregar o áudio.';
    }
  }

  globalScope.NutriFlowChatVoice = { createRecorder, loadAudioPlayer };
})(window);
