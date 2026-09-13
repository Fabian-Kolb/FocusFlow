import React, { createContext, useContext, useState } from 'react';
import { useData } from './DataContext';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [modalPayload, setModalPayload] = useState({});

  const openModal = (modalType, payload = {}) => {
    setActiveModal(modalType);
    setModalPayload(payload);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalPayload({});
  };

  return (
    <ModalContext.Provider value={{
      activeModal,
      modalPayload,
      openModal,
      closeModal
    }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

/**
 * Backwards compatibility hook: Combines pure UI modal controls and application data.
 * This ensures all existing components and tests function without any breaking changes.
 */
export const useModalContext = () => {
  const modal = useModal();
  const data = useData();
  return {
    ...modal,
    ...data
  };
};

export default ModalContext;
