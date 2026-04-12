// ============ 1. PAGE LOADER ==========
function showPageLoader() {
    let loader = document.querySelector('.page-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'page-loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <div class="loader-text">LOADING SHORA GAMES</div>
            <div class="loader-progress"><div class="loader-progress-bar"></div></div>
        `;
        document.body.appendChild(loader);
    }
    loader.classList.remove('hidden');
}

function hidePageLoader() {
    const loader = document.querySelector('.page-loader');
    if (loader) loader.classList.add('hidden');
    setTimeout(() => {
        if (loader) loader.remove();
    }, 500);
}

// ============ 2. SKELETON LOADER ==========
function showSkeleton(containerId, type = 'card', count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        if (type === 'card') {
            skeletonHTML += `
                <div class="skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text" style="width: 70%;"></div>
                    <div class="skeleton skeleton-button" style="margin-top: 16px;"></div>
                </div>
            `;
        } else if (type === 'event') {
            skeletonHTML += `
                <div class="event-card">
                    <div class="skeleton skeleton-title" style="width: 40%; margin-bottom: 12px;"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                    <div class="skeleton skeleton-button" style="margin-top: 16px;"></div>
                </div>
            `;
        }
    }
    container.innerHTML = skeletonHTML;
}

function hideSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
}

// ============ 3. SECTION LOADER ==========
function showSectionLoader(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="section-loader">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
                <span style="color: #888; font-size: 12px;">Loading...</span>
            </div>
        `;
    }
}

function hideSectionLoader(containerId) {
    const container = document.getElementById(containerId);
    if (container && container.querySelector('.section-loader')) {
        container.innerHTML = '';
    }
}

// ============ 4. BUTTON LOADER ==========
function setButtonLoading(button, isLoading, originalText = null) {
    if (isLoading) {
        button.classList.add('btn-loading');
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span class="btn-loader"></span> Loading...';
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        button.innerHTML = button.dataset.originalText || originalText || 'Submit';
        button.disabled = false;
    }
}

// ============ 5. LAZY LOADING ==========
function initLazyLoading() {
    const lazyImages = document.querySelectorAll('.lazy-image');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });
    lazyImages.forEach(img => observer.observe(img));
}

// ============ 6. INFINITE SCROLL ==========
function initInfiniteScroll(containerId, loadMoreFunction) {
    let isLoading = false;
    let hasMore = true;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoading && hasMore) {
                loadMoreFunction();
            }
        });
    });
    
    const trigger = document.createElement('div');
    trigger.className = 'infinite-scroll-trigger';
    trigger.innerHTML = '<div class="infinite-loader"></div>';
    document.getElementById(containerId).appendChild(trigger);
    observer.observe(trigger);
    
    return { setIsLoading: (val) => isLoading = val, setHasMore: (val) => hasMore = val };
}

// ============ 7. PROGRESS BAR ==========
function showProgressBar() {
    let progressBar = document.querySelector('.progress-bar-container');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'progress-bar-container';
        progressBar.innerHTML = '<div class="progress-bar"></div>';
        document.body.appendChild(progressBar);
    }
    progressBar.style.display = 'block';
    const bar = progressBar.querySelector('.progress-bar');
    return {
        setProgress: (percent) => { bar.style.width = percent + '%'; },
        hide: () => { progressBar.style.display = 'none'; bar.style.width = '0%'; }
    };
}

// ============ 8. DATA FETCH LOADER ==========
function showDataLoader(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="data-loader">
                <div class="pulse"></div>
                <span style="color: #3b82f6; font-size: 14px;">Fetching data...</span>
            </div>
        `;
    }
}

function hideDataLoader(containerId) {
    const container = document.getElementById(containerId);
    if (container && container.querySelector('.data-loader')) {
        container.innerHTML = '';
    }
}
