// Interactive 3D Card Tilt Effect with Distance-Based Smooth Transitions
document.addEventListener('DOMContentLoaded', function () {
    const card = document.querySelector('.title-card');

    if (card) {
        let currentRotateX = 0;
        let currentRotateY = 0;
        let currentTranslateZ = 0;
        let currentScale = 1;
        let animationFrameId = null;

        // Cache card rect — re-measure only on resize/scroll
        let cardRect = card.getBoundingClientRect();
        let rectDirty = false;

        function invalidateCardRect() { rectDirty = true; }
        window.addEventListener('scroll', invalidateCardRect, { passive: true });
        window.addEventListener('resize', invalidateCardRect, { passive: true });

        // Smooth animation loop — only writes transform (composite-only)
        function animate() {
            card.style.transform = `perspective(1500px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) translateZ(${currentTranslateZ}px) scale(${currentScale})`;
            animationFrameId = requestAnimationFrame(animate);
        }

        // Mouse move handler for 3D tilt
        card.addEventListener('mousemove', function (e) {
            // Re-measure only when dirty
            if (rectDirty) {
                cardRect = card.getBoundingClientRect();
                rectDirty = false;
            }

            const x = e.clientX - cardRect.left;
            const y = e.clientY - cardRect.top;

            const centerX = cardRect.width / 2;
            const centerY = cardRect.height / 2;

            const deltaX = (x - centerX) / centerX;
            const deltaY = (y - centerY) / centerY;
            const distanceFromCenter = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            const intensityFactor = Math.min(distanceFromCenter, 1);

            const maxTilt = 8;
            const targetRotateX = (deltaY * maxTilt * intensityFactor);
            const targetRotateY = (deltaX * maxTilt * intensityFactor);

            const distanceFromCenterX = Math.abs(x - centerX);
            const isNearHorizontalCenter = distanceFromCenterX < cardRect.width / 6;

            let targetTranslateZ = 0;
            if (isNearHorizontalCenter) {
                const depthIntensity = intensityFactor * 15;
                if (y < centerY) {
                    targetTranslateZ = -(deltaY * depthIntensity);
                } else {
                    targetTranslateZ = (deltaY * depthIntensity);
                }
            }

            const targetScale = 1 + (intensityFactor * 0.03);

            const baseSmoothFactor = 0.08;
            const distanceSmooth = baseSmoothFactor * (1 - intensityFactor * 0.3);

            currentRotateX += (targetRotateX - currentRotateX) * distanceSmooth;
            currentRotateY += (targetRotateY - currentRotateY) * distanceSmooth;
            currentTranslateZ += (targetTranslateZ - currentTranslateZ) * distanceSmooth;
            currentScale += (targetScale - currentScale) * distanceSmooth;

            const percentX = (x / cardRect.width) * 100;
            const percentY = (y / cardRect.height) * 100;

            // CSS vars for gradient lighting — paint-only, no layout
            card.style.setProperty('--x', `${percentX}%`);
            card.style.setProperty('--y', `${percentY}%`);

            if (!animationFrameId) {
                animate();
            }
        }, { passive: true });

        // Reset on mouse leave
        card.addEventListener('mouseleave', function () {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            function resetAnimation() {
                const resetSpeed = 0.12;
                currentRotateX += (0 - currentRotateX) * resetSpeed;
                currentRotateY += (0 - currentRotateY) * resetSpeed;
                currentTranslateZ += (0 - currentTranslateZ) * resetSpeed;
                currentScale += (1 - currentScale) * resetSpeed;

                card.style.transform = `perspective(1500px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) translateZ(${currentTranslateZ}px) scale(${currentScale})`;

                if (Math.abs(currentRotateX) < 0.01 && Math.abs(currentRotateY) < 0.01 && Math.abs(currentTranslateZ) < 0.1 && Math.abs(currentScale - 1) < 0.001) {
                    currentRotateX = 0;
                    currentRotateY = 0;
                    currentTranslateZ = 0;
                    currentScale = 1;
                    card.style.transform = 'perspective(1500px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)';
                    card.style.transition = '';
                    return;
                }

                requestAnimationFrame(resetAnimation);
            }

            resetAnimation();
        });

        card.addEventListener('mouseenter', function () {
            card.style.transition = 'border-color 1s ease-in-out, box-shadow 1s ease-in-out';
            // Refresh rect on enter since card may have scrolled into new position
            cardRect = card.getBoundingClientRect();
            rectDirty = false;
        });
    }
});