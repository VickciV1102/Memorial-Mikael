import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYv63loiIDiQDLcuSfsSjG9OXXse_Jo4g",
  authDomain: "memorial-mikael.firebaseapp.com",
  projectId: "memorial-mikael",
  storageBucket: "memorial-mikael.firebasestorage.app",
  messagingSenderId: "388926482556",
  appId: "1:388926482556:web:a6b2730005fa26146181f9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const memoriesRef = collection(db, "memories");

// --- UI Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const memoryForm = document.getElementById('memory-form');
    const imageUpload = document.getElementById('image-upload');
    const fileNameSpan = document.getElementById('file-name');
    const memoryGrid = document.getElementById('memory-grid');
    const submitBtn = document.getElementById('submit-btn');

    // Modal elements
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalCaption = document.getElementById('modal-caption');
    const closeModal = document.getElementsByClassName('close-modal')[0];

    // File upload label update
    imageUpload.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileNameSpan.textContent = `✅ ${this.files[0].name}`;
        } else {
            fileNameSpan.textContent = '📸 Adicionar uma Foto (Opcional)';
        }
    });

    // Helper: Compress image to avoid Firebase 1MB limit for documents
    function compressImage(file, maxWidth = 800, quality = 0.6) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Resize if larger than maxWidth
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Compress to JPEG format (reduces size drastically)
                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedBase64);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    // Handle form submission
    memoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Publicando...';

        try {
            const author = document.getElementById('author').value;
            const message = document.getElementById('message').value;
            const file = imageUpload.files[0];

            let imageUrl = null;

            // Se tiver imagem, comprime e converte para base64 para salvar direto no banco
            if (file) {
                submitBtn.textContent = 'Otimizando foto...';
                try {
                    imageUrl = await compressImage(file);
                } catch (err) {
                    console.error("Erro na compressão:", err);
                    alert("Erro ao processar a foto. Tente uma foto diferente.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Publicar Memória';
                    return;
                }
            }

            submitBtn.textContent = 'Salvando mensagem...';
            // Salva no Firestore
            await addDoc(memoriesRef, {
                author: author,
                message: message,
                image: imageUrl,
                likes: 0,
                createdAt: new Date().getTime()
            });

            memoryForm.reset();
            fileNameSpan.textContent = '📸 Adicionar uma Foto (Opcional)';
            
            // Scroll para o feed
            document.getElementById('feed').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error("Erro ao salvar memória:", error);
            alert("Ocorreu um erro ao salvar sua mensagem. Verifique se o Firestore está configurado e as regras estão abertas.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publicar Memória';
        }
    });

    // Escuta mudanças no banco de dados em tempo real
    const q = query(memoriesRef, orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        memoryGrid.innerHTML = ''; // Limpa o grid atual
        snapshot.forEach((doc) => {
            const memory = doc.data();
            memory.id = doc.id;
            renderMemory(memory);
        });
    });

    // Renderiza o card da memória
    function renderMemory(memory) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.id = `memory-${memory.id}`;

        const date = new Date(memory.createdAt).toLocaleDateString('pt-BR');
        
        // Verifica se o usuário atual já curtiu
        const likedKey = `liked_${memory.id}`;
        const isLiked = localStorage.getItem(likedKey) === 'true';

        let imageHtml = '';
        if (memory.image) {
            imageHtml = `<img src="${memory.image}" alt="Memória de ${memory.author}" class="memory-image" data-id="${memory.id}">`;
        }

        card.innerHTML = `
            ${imageHtml}
            <div class="memory-content">
                <p class="memory-text">"${escapeHtml(memory.message)}"</p>
                <div class="memory-meta">
                    <div>
                        <span class="memory-author">${escapeHtml(memory.author)}</span>
                        <span class="memory-date">${date}</span>
                    </div>
                    <button class="btn-like ${isLiked ? 'liked' : ''}" data-id="${memory.id}">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        <span>${memory.likes || 0}</span>
                    </button>
                </div>
            </div>
        `;

        memoryGrid.appendChild(card);

        // Event listener para o botão de curtir
        const likeBtn = card.querySelector('.btn-like');
        likeBtn.addEventListener('click', () => handleLike(memory.id, likeBtn));

        // Event listener para abrir a imagem em tela cheia
        const imgEl = card.querySelector('.memory-image');
        if (imgEl) {
            imgEl.addEventListener('click', () => {
                modal.style.display = "block";
                modalImg.src = memory.image;
                modalCaption.innerText = memory.message;
            });
        }
    }

    // Função de Curtir com Transaction
    async function handleLike(id, btnElement) {
        const likedKey = `liked_${id}`;
        const isLiked = localStorage.getItem(likedKey) === 'true';
        const docRef = doc(db, "memories", id);

        try {
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(docRef);
                if (!sfDoc.exists()) throw "Documento não existe!";
                
                const newLikes = isLiked 
                    ? Math.max(0, (sfDoc.data().likes || 0) - 1) 
                    : (sfDoc.data().likes || 0) + 1;
                
                transaction.update(docRef, { likes: newLikes });
            });
            
            localStorage.setItem(likedKey, (!isLiked).toString());
        } catch (error) {
            console.error("Erro ao curtir:", error);
        }
    }

    // Modal Close logic
    closeModal.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Utility: Prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
