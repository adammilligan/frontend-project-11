const errorHandler = (elements, err, i18nInstance) => {
  elements.input.classList.add('is-invalid');
  elements.feedback.textContent = i18nInstance.t(`errors.${err}`);
};

const finishHandler = (elements) => {
  elements.input.classList.remove('is-invalid');
  elements.feedback.textContent = '';
  elements.input.focus();
  elements.form.reset();
};

export default (state, elements, i18nInstance) => (path, value) => {
  switch (path) {
    case 'processState':
      if (value === 'failed') {
        errorHandler(elements, state.validation.error, i18nInstance);
      }
      if (value === 'finished') {
        finishHandler(elements);
      }
      break;

    default:
      break;
  }
};
