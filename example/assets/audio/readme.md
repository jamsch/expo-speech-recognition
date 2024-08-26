# Audio files

## `en-us-sentence.wav`

- Sampling rate: 16000
- PCM 16 bit little endian
- Conversion:

```bash
ffmpeg -i input.wav -c:a pcm_s16le -ac 1 -ar 16000 output.wav
```
