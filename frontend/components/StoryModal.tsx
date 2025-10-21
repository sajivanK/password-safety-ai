import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface StoryModalProps {
  open: boolean;
  onClose: () => void;
  story?: string;
  title?: string;
}

const StoryModal: React.FC<StoryModalProps> = ({ open, onClose, story, title }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white dark:bg-gray-900 p-6 rounded-2xl max-w-lg w-[90%] shadow-xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            <h2 className="text-xl font-semibold mb-3 text-center text-indigo-600">
              {title || "Your Password Story"}
            </h2>
            <p className="text-gray-700 dark:text-gray-200 text-center whitespace-pre-wrap">
              {story || "No story available."}
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-indigo-500 text-white py-2 font-medium hover:bg-indigo-600"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StoryModal;
