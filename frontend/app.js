(function() {
    'use strict';

    let siteData = null;
    let products = [];
    let cart = [];

    async function init() {
        await loadSiteData();
        await loadProducts();
        setupEventListeners();
    }

    async function loadSiteData() {
        try {
            const res = await fetch('/api/site');
            siteData = await res.json();
            renderSiteInfo();
        } catch (e) {
            console.error('Failed to load site data:', e);
        }
    }

    function renderSiteInfo() {
        if (!siteData) return;

        document.title = siteData.title;
        const titleEl = document.getElementById('store-title');
        const descEl = document.getElementById('store-description');
        if (titleEl) titleEl.textContent = siteData.title;
        if (descEl) descEl.textContent = siteData.description;

        const emailEl = document.getElementById('contact-email');
        if (emailEl && siteData.contact.email) {
            emailEl.innerHTML = `<a href="mailto:${siteData.contact.email}">${siteData.contact.email}</a>`;
        }
    }

    async function loadProducts() {
        try {
            const res = await fetch('/api/products');
            products = await res.json();
            renderProducts();
        } catch (e) {
            console.error('Failed to load products:', e);
            document.getElementById('products-grid').innerHTML =
                '<p class="error">Failed to load products. Please try again later.</p>';
        }
    }

    function renderProducts() {
        const grid = document.getElementById('products-grid');

        if (products.length === 0) {
            grid.innerHTML = '<p class="loading">No products available right now. Check back soon!</p>';
            return;
        }

        grid.innerHTML = products.map(product => {
            const inCart = cart.some(item => item.id === product.id);
            return `
            <article class="product-card" data-id="${product.id}">
                ${product.image ? `<img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy">` : ''}
                <div class="product-info">
                    <h3 class="product-name">${escapeHtml(product.name)}</h3>
                    <p class="product-description">${escapeHtml(product.description)}</p>
                    <p class="product-price">${formatPrice(product.price, product.currency)}</p>
                    <div class="product-actions">
                        <button class="btn ${inCart ? 'btn-danger' : 'btn-primary'}" onclick="${inCart ? `removeFromCart('${product.id}')` : `addToCart('${product.id}')`}">
                            ${inCart ? 'Remove' : 'Add To Cart'}
                        </button>
                    </div>
                </div>
            </article>
        `}).join('');
    }

    function addToCart(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        if (cart.some(item => item.id === productId)) return;

        cart.push({ ...product });
        updateCartUI();
        renderProducts();
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        updateCartUI();
        renderProducts();
    }

    function updateCartUI() {
        const cartItems = document.getElementById('cart-items');
        const cartCount = document.getElementById('cart-count');
        const cartTotal = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('checkout-btn');

        if (cart.length > 0) {
            cartCount.textContent = cart.length;
            cartCount.hidden = false;
            checkoutBtn.disabled = false;
        } else {
            cartCount.hidden = true;
            checkoutBtn.disabled = true;
        }

        if (cart.length === 0) {
            cartItems.innerHTML = '<p class="cart-empty">Your cart is empty! Add some beautiful bracelets to get started ✨</p>';
            if (cartTotal) cartTotal.textContent = formatPrice(0, 'usd');
            return;
        }

        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                ${item.image ? `<img class="cart-item-image" src="${item.image}" alt="${item.name}">` : ''}
                <div class="cart-item-info">
                    <p class="cart-item-name">${escapeHtml(item.name)}</p>
                    <p class="cart-item-price">${formatPrice(item.price, item.currency)}</p>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Remove item">&times;</button>
            </div>
        `).join('');

        const total = cart.reduce((sum, item) => sum + item.price, 0);
        cartTotal.textContent = formatPrice(total, cart[0]?.currency || 'usd');
    }

    async function checkout() {
        if (cart.length === 0) return;

        const checkoutBtn = document.getElementById('checkout-btn');
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Processing...';

        try {
            const items = cart.map(item => ({
                price_id: item.price_id,
                quantity: 1,
            }));

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });

            const data = await res.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (e) {
            console.error('Checkout failed:', e);
            alert('Checkout failed. Please try again.');
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Checkout with Stripe';
        }
    }

    function setupEventListeners() {
        document.getElementById('cart-toggle').addEventListener('click', openCart);
        document.getElementById('cart-close').addEventListener('click', closeCart);
        document.getElementById('overlay').addEventListener('click', closeCart);
        document.getElementById('checkout-btn').addEventListener('click', checkout);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeCart();
        });
    }

    function openCart() {
        document.getElementById('cart-popover').classList.remove('hidden');
        document.getElementById('overlay').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        document.getElementById('cart-popover').classList.add('hidden');
        document.getElementById('overlay').classList.add('hidden');
        document.body.style.overflow = '';
    }

    function formatPrice(cents, currency) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
        }).format(cents / 100);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.closeCart = closeCart;

    init();
})();
