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
    const el = element;
    const elName = el.dataset.translate;
    const dest = (elName === 'placeholder_url') ? 'placeholder' : 'textContent';
    el[dest] = i18n.t(`inputForm.${elName}`);
  });
};

const validate = (url, watchedState) => {
  const allFeedUrls = watchedState.data.feeds.map((feed) => feed.url);
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

const getCurrentPosts = (data) => data.posts.map((post) => {
  const { title, link, description } = post;
  return { title, link, description };
});

const updateRSS = (watchedState) => {
  const callBack = () => {
    const { data } = watchedState;
    const urls = data.feeds.map((feed) => feed.url);
    const feedPromises = urls.map((url, index) => axios
      .get(getLinkFormation(url))
      .then((response) => {
        const parsedData = parseRSS(response.data.contents);
        const currentPosts = getCurrentPosts(data);
        const newPosts = getUniquePosts(parsedData.posts, currentPosts);
        const feedUrl = watchedState.data.feeds[index].url;
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

const handleSubmitButtonEvent = (watchedState, elements) => {
  const { dataLoadState, formState, data } = watchedState;
  const formData = new FormData(elements.rssForm);
  const inputPath = formData.get('url');
  formState.status = 'valid';
  dataLoadState.status = 'loading';
  validate(inputPath, watchedState)
    .then(({ url }) => axios.get(getLinkFormation(url)))
    .then((response) => {
      const { contents } = response.data;
      const parsedData = parseRSS(contents);
      formState.status = 'success';
      dataLoadState.status = 'finished';
      const { feed, posts } = normalizeData(parsedData, inputPath);
      data.feeds = [...data.feeds, feed];
      data.posts = [...data.posts, ...posts];
    })
    .catch((err) => {
      formState.status = 'invalid';
      dataLoadState.error = (err.name === 'AxiosError') ? 'badNetwork' : err.message;
      dataLoadState.status = 'failed';
    })
    .finally(() => {
      dataLoadState.status = 'idle';
    });
};

const handlePostButtonEvent = (watchedState, elements, e) => {
  const { id } = e.target.dataset ?? {};
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
      // loadingStatus: 'idle',
      // loadingError: '',
    },
    dataLoadState: {
      status: 'idle',
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
    });
};
