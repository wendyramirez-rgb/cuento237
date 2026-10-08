// Worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Elementos HTML
const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnReadAloud = document.getElementById('btn-read-aloud');
const btnStopAudio = document.getElementById('btn-stop-audio');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const currentPageTextEl = document.getElementById('current-page-text');
const pageIndicatorEl = document.getElementById('page-indicator');

let pageFlip = null;
let pdfPagesText = []; // Almacena el texto extraído de cada página
let currentScale = 1;  // Para escalar el libro y el texto
let currentFontSize = 22; // Tamaño de letra inicial en px para baja visión

// Synth para lectura en voz alta
const synth = window.speechSynthesis;
let currentUtterance = null;

// Cargar automáticamente el archivo "cuento.pdf" alojado en el repositorio
window.addEventListener('DOMContentLoaded', () => {
    fetchPDF('./cuento.pdf');
});

async function fetchPDF(pdfUrl) {
    loading.style.display = 'block';
    try {
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            throw new Error(`No se pudo encontrar el archivo "cuento.pdf" en la raíz del proyecto.`);
        }
        const pdfData = await response.arrayBuffer();
        loadPDF(new Uint8Array(pdfData));
    } catch (error) {
        console.error('Error al cargar cuento.pdf:', error);
        loading.innerText = '❌ No se encontró "cuento.pdf" en el repositorio. Asegúrate de haberlo subido con ese nombre.';
    }
}

async function loadPDF(pdfData) {
    bookContainer.style.display = 'none';
    bookContainer.innerHTML = '';
    pdfPagesText = [];

    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    try {
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        const totalPages = pdf.numPages;

        const firstPage = await pdf.getPage(1);
        const viewportInfo = firstPage.getViewport({ scale: 1.5 });
        const pageWidth = viewportInfo.width;
        const pageHeight = viewportInfo.height;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            // 1. Extraer texto para Lectura Accesible (Baja visión y sintetizador)
            const textContent = await page.getTextContent();
            const pageString = textContent.items.map(item => item.str).join(' ');
            pdfPagesText.push(pageString.trim() || `(Página ${pageNum} sin texto o solo imágenes)`);

            // 2. Renderizar página en canvas
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            bookContainer.appendChild(pageDiv);
        }

        bookContainer.style.display = 'block';

        // Inicializar PageFlip con efectos mejorados
        pageFlip = new St.PageFlip(bookContainer, {
            width: pageWidth,
            height: pageHeight,
            size: "stretch",
            minWidth: 300,
            maxWidth: pageWidth,
            minHeight: 400,
            maxHeight: pageHeight,
            showCover: true,
            maxShadowOpacity: 0.6,
            flippingTime: 800, // Transición más suave para niños
            usePortrait: true
        });

        const pages = document.querySelectorAll('.page');
        pageFlip.loadFromHTML(pages);

        // Evento cambio de página: actualizar texto accesible y parar lectura activa
        pageFlip.on('flip', (e) => {
            stopSpeech();
            updateAccessibleText(e.data);
        });

        // Cargar texto accesible de la primera página
        updateAccessibleText(0);

        loading.style.display = 'none';

    } catch (error) {
        console.error('Error procesando el PDF:', error);
        loading.innerText = 'Error al procesar el cuento PDF.';
    }
}

// Actualiza el contenedor con el texto de la página actual para personas con baja visión
function updateAccessibleText(pageIndex) {
    const totalPages = pdfPagesText.length;
    let textToDisplay = "";

    // Si es vista doble o individual, recopilamos el texto relevante
    if (pageIndex < totalPages) {
        textToDisplay = `<strong>Página ${pageIndex + 1}:</strong> ${pdfPagesText[pageIndex]}`;
    }

    pageIndicatorEl.innerText = `Página ${pageIndex + 1} de ${totalPages}`;
    currentPageTextEl.innerHTML = textToDisplay;
}

// -------------------------------------------------------------
// CONTROLES DE NAVEGACIÓN (PÁGINA ANTERIOR / SIGUIENTE)
// -------------------------------------------------------------
btnPrev.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipPrev();
});

btnNext.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipNext();
});

// -------------------------------------------------------------
// LECTURA EN VOZ ALTA (VOZ INFANTIL / EXPRESIVA EN ESPAÑOL)
// -------------------------------------------------------------
function speakCurrentPage() {
    stopSpeech();

    if (!('speechSynthesis' in window)) {
        alert('Tu navegador no soporta la lectura en voz alta.');
        return;
    }

    const currentIdx = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
    const rawText = pdfPagesText[currentIdx] || "";
    
    // Eliminar notas descriptivas si no hay texto
    const textToRead = rawText.includes("sin texto o solo imágenes") 
        ? "Esta página no contiene texto escrito." 
        : rawText;

    currentUtterance = new SpeechSynthesisUtterance(textToRead);
    currentUtterance.lang = 'es-ES'; // Idioma Español

    // Configuración para simular VOZ INFANTIL Y DULCE:
    // Pitch alto (1.4 - 1.6) eleva el tono simulando una voz infantil/poética.
    currentUtterance.pitch = 1.5; 
    // Rate ligeramente pausado (0.85 - 0.9) para transmitir emociones y facilitar comprensión.
    currentUtterance.rate = 0.88; 

    // Seleccionar voz en español disponible
    const voices = synth.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Child') || v.name.includes('Sabina') || v.name.includes('Monica') || v.name.includes('Paulina') || true));
    
    if (spanishVoice) {
        currentUtterance.voice = spanishVoice;
    }

    currentUtterance.onstart = () => {
        btnReadAloud.style.display = 'none';
        btnStopAudio.style.display = 'inline-block';
    };

    currentUtterance.onend = () => {
        btnReadAloud.style.display = 'inline-block';
        btnStopAudio.style.display = 'none';
    };

    currentUtterance.onerror = () => {
        btnReadAloud.style.display = 'inline-block';
        btnStopAudio.style.display = 'none';
    };

    synth.speak(currentUtterance);
}

function stopSpeech() {
    if (synth.speaking) {
        synth.cancel();
    }
    btnReadAloud.style.display = 'inline-block';
    btnStopAudio.style.display = 'none';
}

btnReadAloud.addEventListener('click', speakCurrentPage);
btnStopAudio.addEventListener('click', stopSpeech);

// Garantizar carga de voces en navegadores como Chrome/Edge
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => synth.getVoices();
}

// -------------------------------------------------------------
// CONTROLES DE AGRANDAR / ACHICAR TEXTO (BAJA VISIÓN) Y ZOOM
// -------------------------------------------------------------
btnZoomIn.addEventListener('click', () => {
    // Aumenta el tamaño de letra del panel accesible
    if (currentFontSize < 40) {
        currentFontSize += 4;
        currentPageTextEl.style.fontSize = `${currentFontSize}px`;
    }
    // Escala ligeramente el visor del libro
    if (currentScale < 1.3) {
        currentScale += 0.1;
        bookContainer.style.transform = `scale(${currentScale})`;
    }
});

btnZoomOut.addEventListener('click', () => {
    if (currentFontSize > 16) {
        currentFontSize -= 4;
        currentPageTextEl.style.fontSize = `${currentFontSize}px`;
    }
    if (currentScale > 0.8) {
        currentScale -= 0.1;
        bookContainer.style.transform = `scale(${currentScale})`;
    }
});