import * as yup from 'yup';
import onChange from 'on-change';
import i18next from 'i18next';
import axios from 'axios';

import resources from './i18n/index.js';
import render from './render';
import parseRSS from './parser.js';
import normalizeData, { getUniquePosts } from './normalizeData.js';

const defaultLanguage = 'ru'; // ru, en
const updateRSSInterval = 5000; // ms

const setLocaleTexts = (elements, i18n) => {
  const { localeTextElements } = elements;
  localeTextElements.forEach((element) => {
    const elName = element.dataset.translate;
    const dest = (elName === 'placeholder_url') ? 'placeholder' : 'textContent';
    element[dest] = i18n.t(`inputForm.${elName}`);
  });
};

const validate = (url, data) => {
  const allFeedUrls = data.feeds.map((feed) => feed.url);
  const urlSchema = yup.string().url('invalidURL').notOneOf(allFeedUrls, 'alreadyExists').required('emptyField');
  const schema = yup.object().shape({ url: urlSchema });
  return schema.validate({ url });
};

const getLinkFormation = (url) => {
  const urlWithProxy = new URL('/get', 'https://allorigins.hexlet.app');
  urlWithProxy.searchParams.set('url', url);
  urlWithProxy.searchParams.set('disableCache', 'true');
  return urlWithProxy.toString();
};

const updateRSS = (data) => {
  const callBack = () => {
    const urls = data.feeds.map((feed) => feed.url);
    const feedPromises = urls.map((url, index) => axios
      .get(getLinkFormation(url))
      .then((response) => {
        const parsedData = parseRSS(response.data.contents);
        const newPosts = getUniquePosts(parsedData.posts, data);
        const feedUrl = data.feeds[index].url;
        const { posts } = normalizeData({ feed: parsedData.feed, posts: newPosts }, feedUrl);
        if (posts.length > 0) {
          data.posts = [...posts, ...data.posts];
        }
      })
      .catch((e) => console.log('Load data error:', e.message)));

    Promise.all(feedPromises)
      .finally(() => setTimeout(callBack, updateRSSInterval));
  };
  callBack();
};

const handleSubmitButtonEvent = (formState, data, elements) => {
  const formData = new FormData(elements.rssForm);
  const inputPath = formData.get('url');
  formState.status = 'valid';
  formState.loadingStatus = 'loading';
  validate(inputPath, data)
    .then(({ url }) => axios.get(getLinkFormation(url)))
    .then((response) => {
      const { contents } = response.data;
      const parsedData = parseRSS(contents);
      formState.status = 'success';
      formState.loadingStatus = 'finished';
      const { feed, posts } = normalizeData(parsedData, inputPath);
      data.feeds = [...data.feeds, feed];
      data.posts = [...data.posts, ...posts];
    })
    .catch((err) => {
      formState.status = 'invalid';
      formState.loadingError = (err.name === 'AxiosError') ? 'badNetwork' : err.message;
      formState.loadingStatus = 'failed';
    });
};

const handlePostButtonEvent = (uiState, elements, e) => {
  const { id } = e.target.dataset ?? {};
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
      loadingStatus: 'idle',
      loadingError: '',
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
  })
    .then(() => {
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
        console.log(state);
        handleSubmitButtonEvent(watchedState.formState, watchedState.data, elements);
      });
      elements.postsContainer.addEventListener('click', (e) => {
        handlePostButtonEvent(watchedState.uiState, elements, e);
      });
      elements.langChangeButton.addEventListener('change', (e) => {
        watchedState.lng = e.target.defaultValue ?? 'ru';
        setLocaleTexts(elements, i18n);
      });
      updateRSS(watchedState.data);
    });
};
