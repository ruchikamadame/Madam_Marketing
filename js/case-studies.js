// Case Studies Carousel Functionality
document.addEventListener('DOMContentLoaded', function() {
    const grid = document.querySelector('.case-studies-grid');
    const cards = document.querySelectorAll('.case-study-card');
    const dotsContainer = document.getElementById('carouselDots');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');
    
    if (!grid || cards.length === 0) return;
    
    let currentIndex = 0;
    
    // Create dots
    cards.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Go to case study ${index + 1}`);
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });
    
    const dots = document.querySelectorAll('.carousel-dot');
    
    // Initialize carousel
    function updateCarousel() {
        cards.forEach((card, index) => {
            card.classList.remove('active', 'inactive');
            if (index === currentIndex) {
                card.classList.add('active');
            } else {
                card.classList.add('inactive');
            }
        });
        
        // Update dots
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
        
        // Update button states
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === cards.length - 1;
    }
    
    function goToSlide(index) {
        currentIndex = Math.max(0, Math.min(index, cards.length - 1));
        updateCarousel();
    }
    
    function nextSlide() {
        if (currentIndex < cards.length - 1) {
            currentIndex++;
            updateCarousel();
        }
    }
    
    function prevSlide() {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel();
        }
    }
    
    // Event listeners
    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });
    
    // Initialize
    updateCarousel();
});
