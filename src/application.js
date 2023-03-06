import * as yup from 'yup';
import onChange from 'on-change';
import i18next from 'i18next';
import axios from 'axios';

import resources from './i18n/index.js';
import render from './render';
import parseRSS from './parser.js';
import normalizeData, { getUniquePosts } from './normalData.js';

const defaultLanguage = 'ru'; // ru, en
const updateRSSInterval = 5000; // ms

const setLocaleTexts = (elements, i18n) => {
  const { localeTextElements } = elements;
  localeTextElements.forEach((element) => {
    const el = element;
    const elName = el.dataset.translate;
    const dest = (elName === 'placeholder_url') ? 'placeholder' : 'textContent';
    el[dest] = i18n.t(`inputForm.${elName}`);
  });
};

const validate = (url, watchedState) => {
  const schema = yup.object().shape({
    url: yup.string().url('invalidURL').notOneOf(watchedState.data.feeds
      .map((feed) => feed.url), 'alreadyExists').required('emptyField'),
  });
  return schema.validate({ url });
};

const getAxiosResponse = (url) => {
  const urlWithProxy = new URL('/get', 'https://allorigins.hexlet.app');
  urlWithProxy.searchParams.set('url', url);
  urlWithProxy.searchParams.set('disableCache', 'true');
  return urlWithProxy.toString();
};

const getCurrentPosts = (data) => data.posts.map((post) => {
  const { title, link, description } = post;
  return { title, link, description };
});

const updateRSS = (watchedState) => {
  const callBack = () => {
    const { data } = watchedState;
    const urls = data.feeds.map((feed) => feed.url);
    const feedPromises = urls.map((url, index) => axios
      .get(getAxiosResponse(url))
      .then((response) => {
        const parsedData = parseRSS(response.data.contents);
        parsedData.feed.url = watchedState.data.feeds[index].url;
        const currentPosts = getCurrentPosts(data);
        const newPosts = getUniquePosts(parsedData.posts, currentPosts);
        const { posts } = normalizeData({ feed: parsedData.feed, posts: newPosts });
        if (posts.length > 0) {
          data.posts = [...posts, ...data.posts];
        }
      })
      .catch((e) => console.log('Load data error:', e.message)));

    Promise.all(feedPromises)
      .finally(() => setTimeout(callBack, updateRSSInterval));
  };
  return callBack();
};

const handleSubmitButtonEvent = (watchedState, elements) => {
  const { dataLoadState, formState, data } = watchedState;
  const formData = new FormData(elements.rssForm);
  const inputPath = formData.get('url');
  formState.status = 'valid';
  dataLoadState.status = 'processing';
  validate(inputPath, watchedState)
    .then(({ url }) => axios.get(getAxiosResponse(url)))
    .then((response) => {
      const { contents } = response.data;
      const parsedData = parseRSS(contents);
      formState.status = 'success';
      dataLoadState.status = 'finished';
      parsedData.feed.url = inputPath;
      const { feed, posts } = normalizeData(parsedData);
      data.feeds = [...data.feeds, feed];
      data.posts = [...data.posts, ...posts];
    })
    .catch((err) => {
      formState.status = 'invalid';
      dataLoadState.error = (err.name === 'AxiosError') ? 'badNetwork' : err.message;
      dataLoadState.status = 'failed';
    })
    .finally(() => {
      dataLoadState.status = 'filling';
    });
};

const handlePostButtonEvent = (watchedState, elements, e) => {
  const { id } = e.target.dataset ?? null;
  const { uiState } = watchedState;
  if (id) {
    uiState.viewedPostsID.add(id);
  }
  if (e.target instanceof HTMLButtonElement) {
    uiState.activeModalID = id;
  }
};

export default () => {
  const state = {
    lng: defaultLanguage,
    formState: {
      status: 'valid',
    },
    dataLoadState: {
      status: 'filling',
      error: '',
    },
    data: {
      posts: [],
      feeds: [],
    },
    uiState: {
      activeModalID: '',
      viewedPostsID: new Set(),
    },
  };

  const i18n = i18next.createInstance();
  i18n.init({
    lng: state.lng,
    debug: false,
    resources,
  });
  const elements = {
    rssForm: document.querySelector('.rss-form'),
    inputField: document.querySelector('#url-input'),
    buttonSubmit: document.querySelector('.btn-lg'),
    feedback: document.querySelector('.feedback'),
    localeTextElements: document.querySelectorAll('[data-translate]'),
    feedsContainer: document.querySelector('.feeds'),
    postsContainer: document.querySelector('.posts'),
    modalTitle: document.querySelector('.modal-title'),
    modalBody: document.querySelector('.modal-body'),
    modalLink: document.querySelector('.full-article'),
    langChangeButton: document.querySelector('#changeLanguage'),
  };
  setLocaleTexts(elements, i18n);

  const watchedState = onChange(state, (path, value) => {
    render(state, i18n, { fullPath: path, value }, elements);
  });

  elements.rssForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmitButtonEvent(watchedState, elements);
  });
  elements.postsContainer.addEventListener('click', (e) => {
    handlePostButtonEvent(watchedState, elements, e);
  });
  elements.langChangeButton.addEventListener('change', (e) => {
    watchedState.lng = e.target.defaultValue ?? 'ru';
    setLocaleTexts(elements, i18n);
  });
  updateRSS(watchedState);
};
