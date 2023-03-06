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
  modal: {
    title: document.querySelector('.modal-title'),
    body: document.querySelector('.modal-body'),
    fullArticleButton: document.querySelector('.full-article'),
  },
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

const postsUpdate = (url, feedId, watchedState) => {
  const timeout = 5000;
  const inner = () => {
    getAxiosResponse(url)
      .then((response) => parseRSS(response.data.contents))
      .then((parsedRSS) => {
        const postsUrls = watchedState.posts
          .filter((post) => feedId === post.feedId)
          .map(({ link }) => link);
        const newPosts = parsedRSS.posts.filter(({ link }) => !postsUrls.includes(link));
        if (newPosts.length > 0) {
          addPosts(feedId, newPosts, watchedState);
        }
      })
      .catch(console.error)
      .finally(() => {
        setTimeout(inner, timeout);
      });
  };

  setTimeout(inner, timeout);
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
        readPostIds: new Set(),
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

            postsUpdate(state.data, feedId, watchedState);

            watchedState.listOfFeeds.push(state.data);
            watchedState.processState = 'finished';
          })
          .catch((err) => {
            watchedState.validation.state = 'invalid';
            watchedState.validation.error = err.message  ?? 'default';
            watchedState.processState = 'failed';
          })
          .finally(() => {
            watchedState.processState = 'filling';
          });
      });
      elements.posts.addEventListener('click', (e) => {
        const postId = +e.target.dataset.id;
        if (postId) {
          watchedState.readPostIds.add(postId);
        }
        if (e.target.dataset.bsTarget === '#modal') {
          const post = state.posts
            .find(({ id }) => postId === id);
          const { title, description, link } = post;
          watchedState.modal = { title, description, link };
        }
      });
    });
};
