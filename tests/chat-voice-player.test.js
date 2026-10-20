const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('reprodutor de mensagens de voz', () => {
	let voice;
	let createdUrls;
	let revokedUrls;

	beforeEach(() => {
		createdUrls = [];
		revokedUrls = [];
		const document = {
			createElement() {
				return {
					dataset: {},
					children: [],
					addEventListener: jest.fn(),
					append(...children) {
						this.children.push(...children);
					},
					setAttribute: jest.fn(),
					pause: jest.fn(),
					play: jest.fn(),
					load: jest.fn(),
					removeAttribute: jest.fn(),
				};
			},
		};
		const context = {
			Blob,
			window: {
				document,
				navigator: {
					mediaDevices: {
						getUserMedia: jest.fn(async () => ({
							getTracks: () => [{ stop: jest.fn() }],
						})),
					},
				},
				URL: {
					createObjectURL(blob) {
						createdUrls.push(blob);
						return `blob:chat-audio-${createdUrls.length}`;
					},
					revokeObjectURL(url) {
						revokedUrls.push(url);
					},
				},
			},
		};
		const source = fs.readFileSync(
			path.join(__dirname, '..', 'frontend', 'chat-voice.js'),
			'utf8',
		);
		vm.runInNewContext(source, context);
		voice = context.window.NutriFlowChatVoice;
	});

	it('confere status e MIME antes de criar player com Blob binário completo', async () => {
		const button = {
			dataset: { audioMessageId: 'message-1' },
			disabled: false,
			replaceWith: jest.fn(),
		};
		const bytes = Buffer.from([0x52, 0x49, 0x46, 0x46]);
		const response = new Response(bytes, {
			headers: { 'Content-Type': 'audio/wav' },
		});

		await voice.loadAudioPlayer(button, async () => response);

		expect(createdUrls).toHaveLength(1);
		expect(createdUrls[0].type).toBe('audio/wav');
		expect(Buffer.from(await createdUrls[0].arrayBuffer())).toEqual(bytes);
		const wrapper = button.replaceWith.mock.calls[0][0];
		const player = wrapper.children[1];
		expect(player.src).toBe('blob:chat-audio-1');
		expect(player.dataset.chatAudioUrl).toBe('blob:chat-audio-1');
	});

	it('não cria Blob para uma resposta 304 e mantém erro visível para nova tentativa', async () => {
		const button = {
			dataset: { audioMessageId: 'message-1' },
			disabled: false,
			textContent: '',
			replaceWith: jest.fn(),
		};
		const response = new Response(null, { status: 304 });

		await voice.loadAudioPlayer(button, async () => response);

		expect(createdUrls).toHaveLength(0);
		expect(button.disabled).toBe(false);
		expect(button.textContent).toContain('Tentar reproduzir novamente');
		expect(button.dataset.error).toContain('HTTP 304');
	});

	it('revoga URLs de áudio quando os players deixam de ser exibidos', async () => {
		const button = {
			dataset: { audioMessageId: 'message-1' },
			disabled: false,
			replaceWith: jest.fn(),
		};
		await voice.loadAudioPlayer(button, async () => new Response(
			Buffer.from('audio'),
			{ headers: { 'Content-Type': 'audio/webm' } },
		));
		const wrapper = button.replaceWith.mock.calls[0][0];
		const player = wrapper.children[1];
		const container = {
			querySelectorAll: jest.fn(() => [player]),
		};

		voice.releaseAudioPlayers(container);

		expect(player.pause).toHaveBeenCalled();
		expect(player.removeAttribute).toHaveBeenCalledWith('src');
		expect(player.load).toHaveBeenCalled();
		expect(revokedUrls).toEqual(['blob:chat-audio-1']);
	});

	it('finalizar uma gravação cria um rascunho sem enviá-lo automaticamente', async () => {
		const mediaListeners = new Map();
		class FakeMediaRecorder {
			static isTypeSupported() {
				return true;
			}

			constructor(stream, options) {
				this.stream = stream;
				this.mimeType = options.mimeType;
				this.state = 'inactive';
			}

			addEventListener(name, callback) {
				mediaListeners.set(name, callback);
			}

			start() {
				this.state = 'recording';
			}

			stop() {
				this.state = 'inactive';
				mediaListeners.get('dataavailable')({ data: new Blob(['voice'], { type: this.mimeType }) });
				mediaListeners.get('stop')();
			}
		}
		const recognitionListeners = new Map();
		class FakeSpeechRecognition {
			addEventListener(name, callback) {
				recognitionListeners.set(name, callback);
			}

			start() {
				recognitionListeners.get('result')({
					resultIndex: 0,
					results: [{ isFinal: true, 0: { transcript: 'Teste transcrito' } }],
				});
			}

			stop() {
				recognitionListeners.get('end')();
			}

			abort() {
				recognitionListeners.get('end')();
			}
		}
		const onDraft = jest.fn();
		const recorderContext = {
			Blob,
			MediaRecorder: FakeMediaRecorder,
			SpeechRecognition: FakeSpeechRecognition,
			navigator: {
				mediaDevices: {
					getUserMedia: jest.fn(async () => ({ getTracks: () => [{ stop: jest.fn() }] })),
				},
			},
			setInterval: jest.fn(() => 1),
			clearInterval: jest.fn(),
			setTimeout,
			clearTimeout,
			URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() },
			document: { createElement: jest.fn() },
		};
		const recorderSource = fs.readFileSync(
			path.join(__dirname, '..', 'frontend', 'chat-voice.js'),
			'utf8',
		);
		const recorderWindow = { ...recorderContext };
		vm.runInNewContext(recorderSource, { ...recorderContext, window: recorderWindow });
		const isolatedRecorder = recorderWindow.NutriFlowChatVoice.createRecorder({
			onRecordingChange: jest.fn(),
			onDraft,
			onTranscript: jest.fn(),
			onError: jest.fn(),
		});

		await isolatedRecorder.start();
		expect(isolatedRecorder.isRecording).toBe(true);
		await isolatedRecorder.stop();
		await new Promise((resolve) => setImmediate(resolve));

		expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({
			audioMimeType: 'audio/webm;codecs=opus',
			audioDurationSeconds: 1,
			transcript: 'Teste transcrito',
			transcriptAvailable: true,
		}));
	});
});
