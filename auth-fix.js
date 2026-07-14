(function () {
    if (!window.firebase) {
        return;
    }

    function showAuthMessage(message, type = 'error') {
        try {
            const formMessage = document.getElementById('formMessage');
            if (!formMessage) {
                return;
            }
            formMessage.textContent = message;
            formMessage.className = `message ${type}`;
            if (message) {
                clearTimeout(showAuthMessage.timeout);
                showAuthMessage.timeout = window.setTimeout(() => {
                    formMessage.textContent = '';
                    formMessage.className = 'message';
                }, 5000);
            }
        } catch (err) {
            console.warn('Unable to display auth message', err);
        }
    }

    function getFriendlyAuthError(error) {
        const err = error || {};
        if (err.code === 'auth/unauthorized-domain') {
            const host = window.location.hostname || 'this site';
            return `This domain is not authorized in Firebase Authentication. Add ${host} in Firebase Console → Authentication → Settings → Authorized domains.`;
        }
        return err.message || String(err);
    }

    function wrapAuthMethods(auth) {
        if (!auth || auth.__wrenchWalletPatched) {
            return auth;
        }

        const methodsToWrap = [
            'createUserWithEmailAndPassword',
            'signInWithEmailAndPassword',
            'sendPasswordResetEmail',
            'signInWithPopup'
        ];

        const wrapped = new Proxy(auth, {
            get(target, property, receiver) {
                const value = target[property];
                if (typeof value === 'function' && methodsToWrap.includes(property)) {
                    return function (...args) {
                        return value.apply(target, args).catch((error) => {
                            const friendly = getFriendlyAuthError(error);
                            showAuthMessage(friendly, 'error');
                            throw Object.assign(error || {}, { message: friendly });
                        });
                    };
                }
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });

        wrapped.__wrenchWalletPatched = true;
        return wrapped;
    }

    const originalAuthFactory = firebase.auth;
    firebase.auth = function (...args) {
        const auth = originalAuthFactory.apply(this, args);
        return wrapAuthMethods(auth);
    };
})();
