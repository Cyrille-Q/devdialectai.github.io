/**
 * @file script.js
 * @description Gestion du formulaire de contact pour la landing page
 * @version 2.0
 * 
 * Fonctionnalités :
 * - Validation côté client (email, consentement, longueur message)
 * - Protection anti-bot (honeypot)
 * - Token de sécurité simple
 * - Rate limiting côté client
 * - Envoi des données vers Google Apps Script
 * - Gestion des états (loading, success, error)
 * - Sanitization des entrées
 * 
 * Sécurité :
 * - Honeypot pour bloquer les bots basiques
 * - Token de vérification
 * - Validation stricte des données
 * - Protection contre le spam (rate limiting)
 */

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    
    /**
     * URL du Google Apps Script Web App
     */
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx7PeM8sLXuhFcaguiHpvNckbKnaWXrJOGn0glxBkKu6gdUQJxG_1rTgHLqX8-STzNVBA/exec';

    /**
     * Token de sécurité simple pour filtrer les requêtes non autorisées
     * Note: Ce token est visible côté client, il sert à bloquer les scripts automatisés basiques
     * Pour une vraie sécurité, utilisez un backend avec authentification
     */
    const SECURITY_TOKEN = 'DDai_2025_LandingPage_SecureToken';

    /**
     * Configuration de la validation
     */
    const VALIDATION_CONFIG = {
        maxMessageLength: 500,
        minTimeBetweenSubmissions: 30000, // 30 secondes entre chaque soumission
    };

    /**
     * Stockage du dernier timestamp de soumission (rate limiting client)
     */
    let lastSubmissionTime = 0;

    // ==================== ÉLÉMENTS DOM ====================
    
    const form = document.getElementById('contact-form');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    const consentCheckbox = document.getElementById('consent');
    const honeypotInput = document.getElementById('website'); // Champ honeypot
    const submitBtn = document.getElementById('submit-btn');
    const submitText = submitBtn.querySelector('.form__submit-text');
    const submitLoading = submitBtn.querySelector('.form__submit-loading');
    const successMessage = document.getElementById('form-success');
    const errorMessage = document.getElementById('form-error');
    const emailError = document.getElementById('email-error');
    const consentError = document.getElementById('consent-error');

    // ==================== UTILITAIRES ====================

    /**
     * Valide le format d'une adresse email (regex plus stricte)
     * @param {string} email - L'adresse email à valider
     * @returns {boolean} - True si l'email est valide
     */
    function isValidEmail(email) {
        // Regex plus complète pour la validation email
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return email.length <= 254 && emailRegex.test(email);
    }

    /**
     * Vérifie si le honeypot est rempli (indique un bot)
     * @returns {boolean} - True si c'est probablement un bot
     */
    function isBot() {
        return honeypotInput && honeypotInput.value.trim() !== '';
    }

    /**
     * Vérifie le rate limiting côté client
     * @returns {boolean} - True si le délai minimum est respecté
     */
    function canSubmit() {
        const now = Date.now();
        const timeSinceLastSubmission = now - lastSubmissionTime;
        return timeSinceLastSubmission >= VALIDATION_CONFIG.minTimeBetweenSubmissions;
    }

    /**
     * Calcule le temps restant avant la prochaine soumission possible
     * @returns {number} - Temps restant en secondes
     */
    function getTimeUntilNextSubmission() {
        const now = Date.now();
        const timeSinceLastSubmission = now - lastSubmissionTime;
        const remaining = VALIDATION_CONFIG.minTimeBetweenSubmissions - timeSinceLastSubmission;
        return Math.ceil(remaining / 1000);
    }

    /**
     * Sanitize une chaîne de caractères (protection XSS basique)
     * @param {string} str - La chaîne à nettoyer
     * @returns {string} - La chaîne nettoyée
     */
    function sanitizeString(str) {
        if (!str) return '';
        return str
            .trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Affiche une erreur sur un champ
     * @param {HTMLElement} input - L'élément input
     * @param {HTMLElement} errorElement - L'élément d'erreur
     * @param {string} message - Le message d'erreur
     */
    function showFieldError(input, errorElement, message) {
        if (input.classList) {
            input.classList.add('form__input--error');
        }
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    /**
     * Efface l'erreur d'un champ
     * @param {HTMLElement} input - L'élément input
     * @param {HTMLElement} errorElement - L'élément d'erreur
     */
    function clearFieldError(input, errorElement) {
        if (input.classList) {
            input.classList.remove('form__input--error');
        }
        if (errorElement) {
            errorElement.textContent = '';
        }
    }

    /**
     * Affiche l'état de chargement du bouton
     * @param {boolean} isLoading - True pour afficher le chargement
     */
    function setLoadingState(isLoading) {
        submitBtn.disabled = isLoading;
        submitText.hidden = isLoading;
        submitLoading.hidden = !isLoading;
    }

    /**
     * Affiche le message de succès
     */
    function showSuccess() {
        successMessage.hidden = false;
        errorMessage.hidden = true;
        form.reset();
    }

    /**
     * Affiche le message d'erreur global
     */
    function showError() {
        errorMessage.hidden = false;
        successMessage.hidden = true;
    }

    /**
     * Cache tous les messages de feedback
     */
    function hideMessages() {
        successMessage.hidden = true;
        errorMessage.hidden = true;
    }

    // ==================== VALIDATION ====================

    /**
     * Valide le formulaire complet
     * @returns {{isValid: boolean, reason?: string}} - Résultat de la validation
     */
    function validateForm() {
        let isValid = true;
        let reason = null;

        // Vérification honeypot (silencieuse - on ne dit pas à l'utilisateur)
        if (isBot()) {
            console.warn('🤖 Bot détecté via honeypot');
            return { isValid: false, reason: 'bot_detected', silent: true };
        }

        // Vérification rate limiting
        if (!canSubmit()) {
            const timeRemaining = getTimeUntilNextSubmission();
            return { 
                isValid: false, 
                reason: `Veuillez patienter ${timeRemaining} secondes avant de renvoyer.`,
                silent: false 
            };
        }
        
        // Validation email
        const email = emailInput.value.trim();
        if (!email) {
            showFieldError(emailInput, emailError, 'L\'adresse email est requise.');
            isValid = false;
        } else if (!isValidEmail(email)) {
            showFieldError(emailInput, emailError, 'Veuillez entrer une adresse email valide.');
            isValid = false;
        } else {
            clearFieldError(emailInput, emailError);
        }

        // Validation longueur du message
        const message = messageInput.value;
        if (message && message.length > VALIDATION_CONFIG.maxMessageLength) {
            showFieldError(messageInput, null, `Le message ne doit pas dépasser ${VALIDATION_CONFIG.maxMessageLength} caractères.`);
            isValid = false;
        }

        // Validation consentement RGPD
        if (!consentCheckbox.checked) {
            showFieldError(consentCheckbox, consentError, 'Vous devez accepter la politique de confidentialité.');
            isValid = false;
        } else {
            clearFieldError(consentCheckbox, consentError);
        }

        return { isValid, reason };
    }

    // ==================== ENVOI DES DONNÉES ====================

    /**
     * Envoie les données du formulaire vers Google Apps Script
     * @param {Object} data - Les données à envoyer
     * @returns {Promise<Object>} - La réponse du serveur
     */
    async function submitToGoogleScript(data) {
        // Ajout du token de sécurité et métadonnées
        const securedData = {
            ...data,
            token: SECURITY_TOKEN,
            clientTimestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.substring(0, 200), // Limité pour éviter les abus
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Nécessaire pour Google Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(securedData),
        });

        // Avec mode: 'no-cors', on ne peut pas lire la réponse
        // On considère que c'est un succès si pas d'erreur réseau
        return { success: true };
    }

    /**
     * Affiche un message d'erreur temporaire
     * @param {string} message - Le message à afficher
     */
    function showTemporaryError(message) {
        const errorDiv = document.getElementById('form-error');
        if (errorDiv) {
            errorDiv.querySelector('p').textContent = `❌ ${message}`;
            errorDiv.hidden = false;
            // Cache automatiquement après 5 secondes
            setTimeout(() => {
                errorDiv.hidden = true;
            }, 5000);
        }
    }

    /**
     * Gère la soumission du formulaire
     * @param {Event} event - L'événement de soumission
     */
    async function handleSubmit(event) {
        event.preventDefault();
        
        // Cache les messages précédents
        hideMessages();

        // Validation
        const validation = validateForm();
        if (!validation.isValid) {
            // Si c'est un bot, on simule un succès (pour ne pas révéler la détection)
            if (validation.silent) {
                // Délai simulé pour paraître naturel
                setLoadingState(true);
                await new Promise(resolve => setTimeout(resolve, 1500));
                setLoadingState(false);
                showSuccess();
                console.log('🤖 Soumission bot ignorée silencieusement');
                return;
            }
            // Affiche le message d'erreur si ce n'est pas silencieux
            if (validation.reason) {
                showTemporaryError(validation.reason);
            }
            return;
        }

        // Préparation des données (avec sanitization)
        const data = {
            email: sanitizeString(emailInput.value),
            message: sanitizeString(messageInput.value).substring(0, VALIDATION_CONFIG.maxMessageLength),
            consent: consentCheckbox.checked,
            timestamp: new Date().toISOString(),
            source: window.location.href,
        };

        // Envoi
        setLoadingState(true);

        try {
            await submitToGoogleScript(data);
            
            // Mise à jour du timestamp de dernière soumission (rate limiting)
            lastSubmissionTime = Date.now();
            
            showSuccess();
            
            // Analytics optionnel (sans tracking invasif)
            console.log('✅ Formulaire soumis avec succès');
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi:', error);
            showError();
        } finally {
            setLoadingState(false);
        }
    }

    // ==================== VALIDATION EN TEMPS RÉEL ====================

    /**
     * Valide l'email à la perte de focus
     */
    function handleEmailBlur() {
        const email = emailInput.value.trim();
        if (email && !isValidEmail(email)) {
            showFieldError(emailInput, emailError, 'Veuillez entrer une adresse email valide.');
        } else {
            clearFieldError(emailInput, emailError);
        }
    }

    /**
     * Efface l'erreur email lors de la saisie
     */
    function handleEmailInput() {
        if (emailInput.classList.contains('form__input--error')) {
            clearFieldError(emailInput, emailError);
        }
    }

    /**
     * Gère le changement de la checkbox
     */
    function handleConsentChange() {
        if (consentCheckbox.checked) {
            clearFieldError(consentCheckbox, consentError);
        }
    }

    // ==================== INITIALISATION ====================

    /**
     * Initialise les écouteurs d'événements
     */
    function init() {
        if (!form) {
            console.error('Formulaire non trouvé');
            return;
        }

        // Soumission du formulaire
        form.addEventListener('submit', handleSubmit);

        // Validation en temps réel
        emailInput.addEventListener('blur', handleEmailBlur);
        emailInput.addEventListener('input', handleEmailInput);
        consentCheckbox.addEventListener('change', handleConsentChange);

        // Log de démarrage
        console.log('📧 Formulaire de contact initialisé');
    }

    // Lancement au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();