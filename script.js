/**
 * @file script.js
 * @description Gestion du formulaire de contact pour la landing page
 * @version 1.0
 * 
 * Fonctionnalités :
 * - Validation côté client (email, consentement)
 * - Envoi des données vers Google Apps Script
 * - Gestion des états (loading, success, error)
 * - Sanitization basique des entrées
 */

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    
    /**
     * URL du Google Apps Script Web App
     */
    const GOOGLE_SCRIPT_URL = 'https://docs.google.com/spreadsheets/d/1QndexliIh-XSaUQY2Ry7t-hNZf-LXG497Nj2CkqVO8U/edit?usp=sharing';

    // ==================== ÉLÉMENTS DOM ====================
    
    const form = document.getElementById('contact-form');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    const consentCheckbox = document.getElementById('consent');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = submitBtn.querySelector('.form__submit-text');
    const submitLoading = submitBtn.querySelector('.form__submit-loading');
    const successMessage = document.getElementById('form-success');
    const errorMessage = document.getElementById('form-error');
    const emailError = document.getElementById('email-error');
    const consentError = document.getElementById('consent-error');

    // ==================== UTILITAIRES ====================

    /**
     * Valide le format d'une adresse email
     * @param {string} email - L'adresse email à valider
     * @returns {boolean} - True si l'email est valide
     */
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
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
     * @returns {boolean} - True si le formulaire est valide
     */
    function validateForm() {
        let isValid = true;
        
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

        // Validation consentement RGPD
        if (!consentCheckbox.checked) {
            showFieldError(consentCheckbox, consentError, 'Vous devez accepter la politique de confidentialité.');
            isValid = false;
        } else {
            clearFieldError(consentCheckbox, consentError);
        }

        return isValid;
    }

    // ==================== ENVOI DES DONNÉES ====================

    /**
     * Envoie les données du formulaire vers Google Apps Script
     * @param {Object} data - Les données à envoyer
     * @returns {Promise<Object>} - La réponse du serveur
     */
    async function submitToGoogleScript(data) {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Nécessaire pour Google Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        // Avec mode: 'no-cors', on ne peut pas lire la réponse
        // On considère que c'est un succès si pas d'erreur réseau
        return { success: true };
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
        if (!validateForm()) {
            return;
        }

        // Préparation des données
        const data = {
            email: sanitizeString(emailInput.value),
            message: sanitizeString(messageInput.value),
            consent: consentCheckbox.checked,
            timestamp: new Date().toISOString(),
            source: window.location.href,
        };

        // Envoi
        setLoadingState(true);

        try {
            await submitToGoogleScript(data);
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