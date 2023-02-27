import { string, setLocale } from 'yup';
import onChange from 'on-change';
import i18next from 'i18next';
import resources from './i18n/index.js';
import render from './render';

const elements = {
  form: document.querySelector('form'),
  input: document.querySelector('input'),
  feedback: document.querySelector('.feedback'),
};

setLocale({
  mixed: {
    notOneOf: 'rssAlreadyExists',
    default: 'dataIsNotValid',
  },
  string: {
    url: 'notValidURL',
  },
});

export default () => {
  const defaultLanguage = 'ru';
  const i18nInstance = i18next.createInstance();
  i18nInstance.init({
    lng: defaultLanguage,
    debug: false,
    resources,
  })
    .then(() => {
      const state = {
        processState: 'filling',
        data: '',
        validation: {
          state: 'valid',
          error: '',
        },
        listOfFeeds: [],
      };

      const watchedState = onChange(state, render(state, elements, i18nInstance));

      elements.form.addEventListener('input', (e) => {
        e.preventDefault();
        const { value } = e.target;
        watchedState.data = value;
      });

      elements.form.addEventListener('submit', (e) => {
        e.preventDefault();

        const schema = string().url().notOneOf(state.listOfFeeds).trim();
        schema.validate(state.data)
          .then(() => {
            watchedState.validation.state = 'valid';
            watchedState.processState = 'sending';
            watchedState.listOfFeeds.push(state.data);
            watchedState.processState = 'finished';
          })
          .catch((err) => {
            watchedState.validation.state = 'invalid';
            watchedState.validation.error = err.message;
            watchedState.processState = 'failed';
          })
          .finally(() => {
            watchedState.processState = 'filling';
          });
      });
    });
};
