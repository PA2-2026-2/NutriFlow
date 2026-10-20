(function setupChatVoice(globalScope) {
  const MAX_RECORDING_SECONDS = 120;
  const MAX_AUDIO_BYTES = 512 * 1024;
  const MAX_TRANSCRIPTION_LENGTH = 2000;
  const activeAudioUrls = new Set();

  function createRecorder({ onRecordingChange, onDraft, onTranscript, onError }) {
    let recorder = null;
    let stream = null;
    let chunks = [];
    let startedAt = 0;
    let timerId = null;
    let recognition = null;
    let transcript = '';
    let cancelled = false;
    let isStopping = false;
    let isStarting = false;
    let transcriptionAvailable = false;
    let recognitionEnded = Promise.resolve();

    function stopTracks() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    function stopRecognition(cancel = false) {
      if (!recognition) return;
      try {
        if (cancel) {
          recognition.abort();
        } else {
          recognition.stop();
        }
      } catch (error) {
        if (error.name !== 'InvalidStateError') onError('Não foi possível finalizar a transcrição.');
      }
    }

    async function finishRecording() {
      if (isStopping || recorder?.state !== 'recording') return;
      isStopping = true;
      globalScope.clearInterval(timerId);
      stopRecognition();
      recorder.stop();
    }

    function startRecognition() {
      const Recognition = globalScope.SpeechRecognition || globalScope.webkitSpeechRecognition;
      if (!Recognition) return false;

      recognition = new Recognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionEnded = new Promise((resolve) => {
        recognition.addEventListener('result', (event) => {
          let finalText = '';
          let interimText = '';
          for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
            const result = event.results[index];
            const text = result[0]?.transcript || '';
            if (result.isFinal) finalText += text;
            else interimText += text;
          }
          if (finalText.trim()) {
            transcript = `${transcript} ${finalText}`.trim().slice(0, MAX_TRANSCRIPTION_LENGTH);
          }
          onTranscript(`${transcript}${interimText ? `${transcript ? ' ' : ''}${interimText}` : ''}`.slice(0, MAX_TRANSCRIPTION_LENGTH));
        });
        recognition.addEventListener('error', (event) => {
          if (!['aborted', 'no-speech'].includes(event.error)) {
            onError('A transcrição não ficou disponível. Você ainda pode ouvir e enviar o áudio.');
          }
        });
        recognition.addEventListener('end', resolve, { once: true });
      });
      try {
        recognition.start();
        return true;
      } catch {
        recognition = null;
        recognitionEnded = Promise.resolve();
        return false;
      }
    }

    async function start() {
      if (isStarting || recorder?.state === 'recording') return;
      if (!globalScope.navigator?.mediaDevices?.getUserMedia || !globalScope.MediaRecorder) {
        onError('A gravação de áudio não é compatível com este navegador.');
        return;
      }

      isStarting = true;
      try {
        stream = await globalScope.navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = typeof globalScope.MediaRecorder.isTypeSupported === 'function'
          ? ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg']
            .find((type) => globalScope.MediaRecorder.isTypeSupported(type))
          : '';
        recorder = new globalScope.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunks = [];
        transcript = '';
        cancelled = false;
        isStopping = false;
        startedAt = Date.now();
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size) chunks.push(event.data);
        });
        recorder.addEventListener('stop', async () => {
          globalScope.clearInterval(timerId);
          stopTracks();
          onRecordingChange(false, 0);
          await recognitionEnded;
          recognition = null;
          if (cancelled) {
            chunks = [];
            return;
          }
          const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000));
          if (durationSeconds > MAX_RECORDING_SECONDS) {
            chunks = [];
            onError(`A gravação pode ter no máximo ${MAX_RECORDING_SECONDS} segundos.`);
            return;
          }
          const blob = new Blob(chunks, { type: recorder.mimeType });
          chunks = [];
          if (!blob.size || blob.size > MAX_AUDIO_BYTES) {
            onError('O áudio deve ter no máximo 512 KB.');
            return;
          }
          if (!blob.type.startsWith('audio/')) {
            onError('O navegador gravou em um formato de áudio não suportado.');
            return;
          }
          onDraft({
            blob,
            audioMimeType: blob.type,
            audioDurationSeconds: durationSeconds,
            transcript,
            transcriptAvailable: transcriptionAvailable,
          });
        }, { once: true });
        recorder.start();
        isStarting = false;
        transcriptionAvailable = startRecognition();
        onRecordingChange(true, 0, transcriptionAvailable);
        timerId = globalScope.setInterval(() => {
          const elapsed = Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - startedAt) / 1000));
          onRecordingChange(true, elapsed, transcriptionAvailable);
          if (elapsed >= MAX_RECORDING_SECONDS) void finishRecording();
        }, 250);
      } catch (error) {
        isStarting = false;
        stopTracks();
        onError(error.name === 'NotAllowedError'
          ? 'Permita o acesso ao microfone para gravar uma mensagem.'
          : 'Não foi possível acessar o microfone.');
      }
    }

    async function cancel() {
      if (recorder?.state !== 'recording') return;
      cancelled = true;
      globalScope.clearInterval(timerId);
      stopRecognition(true);
      recorder.stop();
    }

    return {
      start,
      stop: finishRecording,
      cancel,
      get isRecording() {
        return recorder?.state === 'recording';
      },
    };
  }

  function formatDuration(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new globalScope.FileReader();
      reader.addEventListener('load', () => {
        const result = String(reader.result || '');
        const separator = result.indexOf(',');
        if (separator < 0) {
          reject(new Error('Não foi possível preparar o áudio para envio.'));
          return;
        }
        resolve(result.slice(separator + 1));
      }, { once: true });
      reader.addEventListener('error', () => reject(new Error('Não foi possível ler o áudio gravado.')), { once: true });
      reader.readAsDataURL(blob);
    });
  }

  function createAudioControls(container, blob, className = '') {
    const source = globalScope.URL.createObjectURL(blob);
    activeAudioUrls.add(source);
    const audio = globalScope.document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = source;
    audio.dataset.chatAudioUrl = source;
    const controls = globalScope.document.createElement('div');
    controls.className = `flex w-full min-w-0 items-center gap-2 ${className}`.trim();
    const playButton = globalScope.document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-nutriflow-800 font-bold text-white';
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Reproduzir áudio');
    const progress = globalScope.document.createElement('input');
    progress.type = 'range';
    progress.min = '0';
    progress.max = '1000';
    progress.value = '0';
    progress.className = 'min-w-0 flex-1 accent-nutriflow-800';
    progress.setAttribute('aria-label', 'Progresso do áudio');
    const time = globalScope.document.createElement('span');
    time.className = 'shrink-0 text-xs tabular-nums';
    time.textContent = '0:00 / 0:00';
    const updateTime = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const current = audio.currentTime || 0;
      progress.value = String(duration ? Math.round((current / duration) * 1000) : 0);
      time.textContent = `${formatDuration(current)} / ${formatDuration(duration)}`;
    };
    playButton.addEventListener('click', async () => {
      if (audio.paused) {
        try {
          await audio.play();
        } catch {
          playButton.textContent = '▶';
          playButton.setAttribute('aria-label', 'Reproduzir áudio');
        }
      } else {
        audio.pause();
      }
    });
    audio.addEventListener('play', () => {
      playButton.textContent = 'Ⅱ';
      playButton.setAttribute('aria-label', 'Pausar áudio');
    });
    audio.addEventListener('pause', () => {
      playButton.textContent = '▶';
      playButton.setAttribute('aria-label', 'Reproduzir áudio');
    });
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateTime);
    audio.addEventListener('ended', () => {
      audio.currentTime = 0;
      updateTime();
    });
    progress.addEventListener('input', () => {
      if (Number.isFinite(audio.duration)) {
        audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
      }
    });
    controls.append(playButton, progress, time);
    container.append(controls, audio);
    audio.className = 'hidden';
    return { audio, source };
  }

  function renderDraftPreview(container, draft, { onSend, onDiscard, onTranscriptChange }) {
    releaseAudioPlayers(container);
    container.replaceChildren();
    container.className = 'grid gap-3 rounded-xl border border-nutriflow-200 bg-nutriflow-50 p-3';
    const { audio } = createAudioControls(container, draft.blob);
    let transcriptInput = null;
    if (draft.transcriptAvailable) {
      const label = globalScope.document.createElement('label');
      label.className = 'grid gap-1 text-xs font-semibold text-nutriflow-700';
      label.textContent = 'Transcrição (você pode editar antes de enviar)';
      transcriptInput = globalScope.document.createElement('textarea');
      transcriptInput.maxLength = MAX_TRANSCRIPTION_LENGTH;
      transcriptInput.rows = 3;
      transcriptInput.value = draft.transcript || '';
      transcriptInput.placeholder = 'A transcrição aparecerá aqui quando o reconhecimento estiver disponível.';
      transcriptInput.className = 'w-full resize-y rounded-lg border border-nutriflow-200 bg-white px-3 py-2 text-sm';
      transcriptInput.addEventListener('input', () => onTranscriptChange(transcriptInput.value));
      label.append(transcriptInput);
      container.append(label);
    } else {
      const note = globalScope.document.createElement('p');
      note.className = 'text-xs text-nutriflow-600';
      note.textContent = 'Transcrição automática indisponível neste navegador. Você ainda pode ouvir e enviar o áudio.';
      container.append(note);
    }
    const privacyNote = globalScope.document.createElement('p');
    privacyNote.className = 'text-[11px] text-nutriflow-500';
    privacyNote.textContent = 'A transcrição usa o recurso de reconhecimento de fala do navegador, que pode processar áudio conforme o fornecedor e as configurações do dispositivo.';
    container.append(privacyNote);

    const actions = globalScope.document.createElement('div');
    actions.className = 'flex flex-wrap justify-end gap-2';
    const discardButton = globalScope.document.createElement('button');
    discardButton.type = 'button';
    discardButton.textContent = 'Apagar';
    discardButton.className = 'rounded-lg border border-nutriflow-300 px-3 py-2 text-sm font-bold';
    discardButton.addEventListener('click', () => {
      releaseAudioPlayers(container);
      container.replaceChildren();
      container.classList.add('hidden');
      onDiscard();
    });
    const sendButton = globalScope.document.createElement('button');
    sendButton.type = 'button';
    sendButton.textContent = 'Enviar áudio';
    sendButton.className = 'rounded-lg bg-nutriflow-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
    sendButton.addEventListener('click', async () => {
      if (sendButton.disabled) return;
      sendButton.disabled = true;
      discardButton.disabled = true;
      sendButton.textContent = 'Enviando...';
      try {
        await onSend({
          audio: draft.blob,
          audioMimeType: draft.audioMimeType,
          audioDurationSeconds: draft.audioDurationSeconds,
          transcript: transcriptInput?.value.trim() || '',
        });
      } catch (error) {
        sendButton.disabled = false;
        discardButton.disabled = false;
        sendButton.textContent = 'Tentar enviar novamente';
      }
    });
    actions.append(discardButton, sendButton);
    container.append(actions);
    return { audio, transcriptInput };
  }

  async function loadAudioPlayer(button, fetchAudio) {
    const messageId = button.dataset.audioMessageId;
    if (!messageId || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Carregando áudio...';
    try {
      const response = await fetchAudio(messageId);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || `Não foi possível carregar o áudio (HTTP ${response.status}).`);
      }
      const mimeType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
      if (!mimeType?.startsWith('audio/')) {
        throw new Error('A resposta do servidor não contém um formato de áudio válido.');
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('O áudio recebido está vazio.');
      if (blob.type && blob.type.toLowerCase() !== mimeType) {
        throw new Error('O formato do áudio recebido não corresponde à resposta do servidor.');
      }
      const wrapper = globalScope.document.createElement('div');
      wrapper.className = 'w-full min-w-0';
      createAudioControls(wrapper, new Blob([blob], { type: mimeType }));
      const transcript = button.dataset.audioTranscript;
      if (transcript) {
        const transcriptElement = globalScope.document.createElement('p');
        transcriptElement.className = 'mt-2 whitespace-pre-wrap break-words text-sm';
        transcriptElement.textContent = transcript;
        const toggle = globalScope.document.createElement('button');
        toggle.type = 'button';
        toggle.textContent = 'Ver transcrição';
        toggle.className = 'mt-2 text-xs font-bold underline';
        toggle.setAttribute('aria-expanded', 'false');
        transcriptElement.hidden = true;
        toggle.addEventListener('click', () => {
          transcriptElement.hidden = !transcriptElement.hidden;
          toggle.textContent = transcriptElement.hidden ? 'Ver transcrição' : 'Ocultar transcrição';
          toggle.setAttribute('aria-expanded', String(!transcriptElement.hidden));
        });
        wrapper.append(toggle, transcriptElement);
      }
      button.replaceWith(wrapper);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Tentar reproduzir novamente';
      button.dataset.error = error.message || 'Não foi possível carregar o áudio.';
    }
  }

  function releaseAudioPlayers(container) {
    container?.querySelectorAll('audio[data-chat-audio-url]').forEach((audio) => {
      const source = audio.dataset.chatAudioUrl;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (activeAudioUrls.delete(source)) globalScope.URL.revokeObjectURL(source);
    });
  }

  globalScope.NutriFlowChatVoice = {
    createRecorder,
    blobToBase64,
    formatDuration,
    loadAudioPlayer,
    releaseAudioPlayers,
    renderDraftPreview,
  };
})(window);
