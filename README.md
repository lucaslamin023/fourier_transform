# Transformada de Fourier de forma interativa

[Aplicação web](http://fouriertransform-seven.vercel.app/pages/contornos.html) interativa dedicada ao estudo intuitivo, histórico e prático da **Transformada de Fourier**, complementada por um notebook Jupyter com experimentos em Python.

---

## O que o projeto contém

### 1. Página Principal
Uma página para apresentação e contextualização de todo o tema.
- **Introdução intuitiva**: sinais no domínio do tempo vs. frequência e a analogia.
- **Visão em ciclos**: decomposição em caminhos circulares, exemplos práticos (sismologia, áudio, compressão e rádio) e comparação entre senoide (1D) e círculo (2D).
- **Contextualização histórica**: da teoria de Fourier à corrida computacional da Guerra Fria e o salto da FFT de Cooley-Tukey ($O(N^2) \to O(N \log_2 N)$).
- **Resumo matemático**: leitura visual colorida da DFT ($X_k = \frac{1}{N}\sum_{n=0}^{N-1} x_n e^{i 2\pi k \frac{n}{N}}$) e alguns pilares matemáticos.

### 2. Laboratório Interativo
Todos os módulos rodam **100% client-side** em HTML/CSS/JavaScript puro, usando Canvas 2D e WebAudio API:

- **Contornos por Linguagem Natural**: interpreta descrições em texto (biblioteca vetorial local, silhuetas SVG via Iconify API e fronteiras geográficas via OpenStreetMap Nominatim) e desenha qualquer silhueta fechada por epiciclos de Fourier, começando em 1 círculo com ajuste gradual.
- **Ondas, Harmônicos & Som**: sintetizador aditivo com presets clássicos, manipulação individual de amplitude e fase dos harmônicos e reprodução sonora por frequência.
- **Hélice 3D de Euler**: visualização tridimensional interativa da exponencial complexa $e^{i\omega t}$ e suas projeções no plano complexo (Argand), seno e cosseno.
- **Desenho Livre → Epiciclos & Som**: desenhe qualquer traço fechado com mouse ou toque, calcule sua DFT complexa em tempo real e ouça o formato como wavetable, arpejo ou osciloscópio estéreo.
- **MP3, Microfone & Áudio**: carregue arquivos de áudio locais, utilize o microfone ou faixas sintéticas para explorar espectrograma HD, mandala polar de Fourier, barras espectrais e filtros passa-baixa/passa-alta/passa-banda ao vivo.

### 3. Notebook de Estudo
Notebook Jupyter em Python (`numpy` e `matplotlib`) com células práticas para testar:
- Decomposição de sinais no domínio do tempo e da frequência;
- Enrolamento circular no plano complexo e cálculo do centro de massa;
- DFT manual comparada à `np.fft.fft` e reconstrução por `ifft`;
- Aproximação da onda quadrada e epiciclos 2D em contornos complexos.

- - -

## Inspirado por:

- Prof. P. Seleghim - [Entendendo a Transformada de Fourier: de Aristóteles a Roberto Carlos](https://www.youtube.com/watch?v=rJWYbmHZm3Q)
- Pedro Loos - [O Algoritmo que Mudou o Mundo](https://www.youtube.com/watch?v=1m0hqj92ff4)
- 3Blue1Brown - [But what is the Fourier Transform? A visual introduction.](https://www.youtube.com/watch?v=spUNpyF58BY)
- Stuart Riffle - [Understanding the Fourier transform](https://web.archive.org/web/20120418231513/http://www.altdevblogaday.com/2011/05/17/understanding-the-fourier-transform/)
- Jezzamon - [An Interactive Introduction to Fourier Transforms](https://www.jezzamon.com/fourier/)
- [Fourier Transform - A visual Introduction](https://github.com/thatSaneKid/fourier)
- [FourierCircleDrawing](https://github.com/ruanluyu/FourierCircleDrawing)





