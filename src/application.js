import { string, setLocale } from 'yup';
import onChange from 'on-change';
import i18next from 'i18next';
import axios from 'axios';

import resources from './i18n/index.js';
import render from './render';
import parseRSS from './parser.js';

const elements = {
  form: document.querySelector('form'),
  input: document.querySelector('input'),
  feedback: document.querySelector('.feedback'),
  btn: document.querySelector('button[type="submit"]'),
  posts: document.querySelector('.posts'),
  feeds: document.querySelector('.feeds'),
};

let counter = 0;
const getId = () => {
  counter += 1;
  return counter;
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

const getAxiosResponse = (url) => {
  const allOriginsLink = 'https://allorigins.hexlet.app/get';

  const preparedURL = new URL(allOriginsLink);
  preparedURL.searchParams.set('disableCache', 'true');
  preparedURL.searchParams.set('url', url);

  return axios.get(preparedURL);
};

const addFeeds = (id, title, description, watchedState) => {
  watchedState.feeds.push({ id, title, description });
};

const addPosts = (feedId, posts, watchedState) => {
  const result = posts.map((post) => ({
    feedId,
    id: getId(),
    title: post.title,
    description: post.description,
    link: post.link,
  }));
  watchedState.posts = result.concat(watchedState.posts);
};

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
        feeds: [],
        posts: [],
      };

      const watchedState = onChange(state, render(state, elements, i18nInstance));
      elements.form.addEventListener('input', (e) => {
        e.preventDefault();
        watchedState.data = e.target.value;
      });
      elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const schema = string().url().notOneOf(state.listOfFeeds).trim();
        schema.validate(state.data)
          .then(() => {
            watchedState.validation.state = 'valid';
            watchedState.processState = 'sending';
          })
          .then(() => getAxiosResponse(state.data))
          .then((response) => parseRSS(response.data.contents))
          .then((parsedRSS) => {
            const feedId = getId();
            const title = parsedRSS.feed.channelTitle;
            const description = parsedRSS.feed.channelDescription;

            addFeeds(feedId, title, description, watchedState);
            addPosts(feedId, parsedRSS.posts, watchedState);

            // console.log(state.feeds, state.posts);

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
