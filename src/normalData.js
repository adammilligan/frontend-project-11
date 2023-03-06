import _ from 'lodash';

// eslint-disable-next-line max-len
export const getUniquePosts = (posts, currentPosts) => _.differenceWith(posts, currentPosts, _.isEqual);

export default (data) => {
  const { feed, posts } = data;
  const feedId = _.get(feed, 'id', _.uniqueId('feed'));
  const normalizedFeed = { ...feed, id: feedId };
  const normalizedPosts = posts.map((post) => {
    const id = _.uniqueId('post');
    return { ...post, id, feedId };
  });
  return { feed: normalizedFeed, posts: normalizedPosts };
};
