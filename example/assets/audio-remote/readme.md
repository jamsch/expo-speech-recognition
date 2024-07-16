# Audio files

## `remote-en-us-sentence-16000hz-pcm_s16le.wav`

- Sampling rate: 16000
- PCM 16 bit little endian
- Conversion:

```bash
ffmpeg -i input.wav -c:a pcm_s16le -ar 16000 output.wav
```
