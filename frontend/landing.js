import { createIcons, BookOpen, LayoutDashboard, RefreshCw, Languages, ShieldCheck, MessageSquare, Heart, X } from 'lucide';

createIcons({
    icons: {
        BookOpen,
        LayoutDashboard,
        RefreshCw,
        Languages,
        ShieldCheck,
        MessageSquare,
        Heart,
        X
    }
});

const privacyTermsBtn = document.getElementById('privacyTermsBtn');
const privacyTermsModal = document.getElementById('privacyTermsModal');
const privacyTermsCloseBtn = document.getElementById('privacyTermsCloseBtn');

if (privacyTermsBtn && privacyTermsModal && privacyTermsCloseBtn) {
    privacyTermsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        privacyTermsModal.classList.add('active');
    });

    const closeModal = () => {
        privacyTermsModal.classList.remove('active');
    };

    privacyTermsCloseBtn.addEventListener('click', closeModal);
    privacyTermsModal.addEventListener('click', (e) => {
        if (e.target === privacyTermsModal) {
            closeModal();
        }
    });
}
