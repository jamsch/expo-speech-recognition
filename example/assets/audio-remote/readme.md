# Audio files

## `remote-en-us-sentence-16000hz-pcm_s16le.wav`

- Sampling rate: 16000
- PCM 16 bit little endian
- Conversion:

```bash
ffmpeg -i input.wav -c:a pcm_s16le -ar 16000 output.wav
```

## `remote-en-us-sentence-16000hz.mp3`

- Sampling rate: 16000
- MP3 1-channel
- Conversion:

```bash
ffmpeg -i input.mp3 -c:a mp3 -ar 16000 output.mp3
```

## `remote-en-us-sentence-16000hz.ogg`

- Sampling rate: 16000
- Opus 1-channel
- Conversion:

```bash
ffmpeg -i input.ogg -c:a libopus -ar 16000 output.ogg
```
