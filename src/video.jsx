import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import cx from 'classnames';
import lodash from 'lodash';
import vjs from './videojs';
var _forEach = lodash.forEach;
var _debounce = lodash.debounce;
var _defaults = lodash.defaults;
import _ from 'lodash'

import MarkerBar from './markerBar';
import Marker from './marker';

const DEFAULT_HEIGHT = 540;
const DEFAULT_WIDTH = 960;
const DEFAULT_ASPECT_RATIO = (9 / 16);
const DEFAULT_ADJUSTED_SIZE = 0;
const DEFAULT_RESIZE_DEBOUNCE_TIME = 500;
const DEFAULT_VIDEO_OPTIONS = {
  preload: 'auto',
  autoPlay: true,
  controls: true
};


function noop() {}


export default class ReactVideoJsComponent extends Component {

  static propTypes = {
    src: React.PropTypes.string.isRequired,
    height: React.PropTypes.number,
    width: React.PropTypes.number,
    endlessMode: React.PropTypes.bool,
    options: React.PropTypes.object,
    onReady: React.PropTypes.func,
    poster: React.PropTypes.string,
    tracks: React.PropTypes.arrayOf(React.PropTypes.object),
    eventListeners: React.PropTypes.object,
    unboundOnReady: React.PropTypes.func,
    resize: React.PropTypes.bool,
    resizeOptions: React.PropTypes.shape({
      aspectRatio: React.PropTypes.number,
      shortWindowVideoHeightAdjustment: React.PropTypes.number,
      defaultVideoWidthAdjustment: React.PropTypes.number,
      debounceTime: React.PropTypes.number
    }),
    vjsDefaultSkin: React.PropTypes.bool,
    vjsBigPlayCentered: React.PropTypes.bool,
    startWithControlBar: React.PropTypes.bool,
    markers: React.PropTypes.arrayOf(React.PropTypes.object),
    children: React.PropTypes.oneOfType([React.PropTypes.object,
      React.PropTypes.arrayOf(React.PropTypes.element),
      React.PropTypes.element]),
    dispose: React.PropTypes.bool,
    onNextVideo: React.PropTypes.func
  };

  static defaultProps = {
    endlessMode: false,
    options: DEFAULT_VIDEO_OPTIONS,
    onReady: noop,
    eventListeners: {},
    resize: false,
    resizeOptions: {},
    vjsDefaultSkin: true,
    vjsBigPlayCentered: true,
    startWithControlBar: false,
    markers: [],
    onNextVideo: noop
  };

  constructor(props) {
    super(props);
    //initial state
    this.state = {
       
    };
  }

  componentDidMount() {
    this.mountVideoPlayer();
  }

  componentWillReceiveProps(nextProps) {
    var isEndless = this.props.endlessMode;
    var willBeEndless = nextProps.endlessMode;

    if (isEndless !== willBeEndless) {
      if (willBeEndless) {
        this.addEndlessMode();
      } else {
        this.removeEndlessMode();
      }
    }

    var isResizable = this.props.resize;
    var willBeResizeable = nextProps.resize;

    if (isResizable !== willBeResizeable) {
      if (willBeResizeable) {
        this.addResizeEventListener();
      } else {
        this.removeResizeEventListener();
      }
    }

    var currentSrc = this.props.src;
    var newSrc = nextProps.src;

    if (currentSrc !== newSrc) {
      this.addTextTracks(nextProps)
      this.setPoster(nextProps)
      this.setVideoPlayerSrc(newSrc);
      this.restartVideo();
    }
  }

  shouldComponentUpdate() {
    return false;
  }

  componentWillUnmount() {
    this.unmountVideoPlayer();
  }

  drawMarker(markerOptions) {
    if(!this._markerBar){
      this._markerBar = this._player.controlBar.progressControl.addChild(new MarkerBar());
    }

    var marker = new Marker(this._player, markerOptions);
    this._markerBar.addChild(marker);
  }

  getVideoPlayer() {
    return this._player;
  }

  getVideoPlayerEl() {
    return ReactDOM.findDOMNode(this.refs.videoPlayer);
  }

  getVideoPlayerOptions() {
    return _defaults(
      {}, this.props.options, DEFAULT_VIDEO_OPTIONS);
  }

  getVideoResizeOptions() {
    return _defaults({}, this.props.resizeOptions, {
      aspectRatio: DEFAULT_ASPECT_RATIO,
      shortWindowVideoHeightAdjustment: DEFAULT_ADJUSTED_SIZE,
      defaultVideoWidthAdjustment: DEFAULT_ADJUSTED_SIZE,
      debounceTime: DEFAULT_RESIZE_DEBOUNCE_TIME
    });
  }

  getResizedVideoPlayerMeasurements() {
    var resizeOptions = this.getVideoResizeOptions();
    var aspectRatio = resizeOptions.aspectRatio;
    var defaultVideoWidthAdjustment = resizeOptions.defaultVideoWidthAdjustment;

    var winHeight = this._windowHeight();

    var baseWidth = this._videoElementWidth();

    var vidWidth = baseWidth - defaultVideoWidthAdjustment;
    var vidHeight = vidWidth * aspectRatio;

    if (winHeight < vidHeight) {
      var shortWindowVideoHeightAdjustment = resizeOptions.shortWindowVideoHeightAdjustment;
      vidHeight = winHeight - shortWindowVideoHeightAdjustment;
    }

    return {
      width: vidWidth,
      height: vidHeight
    };
  }

  setVideoPlayerSrc(src) {
    this._player.src(src);
  }

  mountVideoPlayer() {
    var src = this.props.src;
    var options = this.getVideoPlayerOptions();

    var playerEl =this.getVideoPlayerEl()
    playerEl.removeAttribute('data-reactid');

    this._player = vjs(playerEl, options);

    var player = this._player;

    _forEach(this.props.markers, this.drawMarker.bind(this));

    player.ready(this.handleVideoPlayerReady.bind(this));

    if (this.props.unboundOnReady) {
      player.ready(this.props.unboundOnReady)
    }

    _forEach(this.props.eventListeners, function(val, key) {
      player.on(key, val);
    });

    this.addTextTracks(this.props)
    this.setPoster(this.props)
    player.src(src);

    if (this.props.endlessMode) {
      this.addEndlessMode();
    }
  }

  setPoster({poster}) {
    const $poster = jQuery('.vjs-poster', this._player.id)
    $poster.removeClass('vjs-hidden')
    $poster.css('background-image', `url('${poster}')`)
  }

  addTextTracks({tracks}) {
    const currentTracks = this._player.textTracks()
    if (currentTracks) {
      currentTracks.tracks_.map((track) => {
        this._player.removeRemoteTextTrack(track)
      })
    }
    if (tracks) {
      tracks.map((track) => {
        this._player.addRemoteTextTrack(track)
      })
    }
  }

  unmountVideoPlayer() {
    this.removeResizeEventListener();
    if(!this._player){
      this._player.dispose();
    }
  }

  addEndlessMode() {
    var player = this._player;

    player.on('ended', this.handleNextVideo);

    if (player.ended()) {
      this.handleNextVideo();
    }
  }

  addResizeEventListener() {
    var debounceTime = this.getVideoResizeOptions().debounceTime;

    this._handleVideoPlayerResize = _debounce(this.handleVideoPlayerResize.bind(this), debounceTime);
    window.addEventListener('resize', this._handleVideoPlayerResize);
  }

  removeEndlessMode() {
    var player = this._player;

    player.off('ended', this.handleNextVideo);
  }

  removeResizeEventListener() {
    window.removeEventListener('resize', this._handleVideoPlayerResize);
  }

  pauseVideo() {
    this._player.pause();
  }

  playVideo() {
    this._player.play();
  }

  setCurrentTime(time) {
    this._player.currentTime(time);
  }

  restartVideo() {
    this._player.currentTime(0);
  }

  togglePauseVideo() {
    if (this._player.paused()) {
      this.playVideo();
    } else {
      this.pauseVideo();
    }
  }

  handleVideoPlayerReady() {

    if (this.props.resize) {
      this.handleVideoPlayerResize();
      this.addResizeEventListener();
    }

    if(this.props.startWithControlBar){
      this._player.bigPlayButton.hide();
      this._player.controlBar.show();
      this._player.userActive(true);
      this._player.play();
      this._player.pause();
    }

    this.props.onReady();
  }

  handleVideoPlayerResize() {
    var player = this._player;
    var videoMeasurements = this.getResizedVideoPlayerMeasurements();

    player.dimensions(videoMeasurements.width, videoMeasurements.height);
  }

  handleNextVideo() {
    this.props.onNextVideo();
  }

  renderDefaultWarning() {
    return (
      <p>test</p>
    );
  }

  _windowHeight() {
    return window.innerHeight;
  }

  _videoElementWidth() {
    const videoPlayer = this.getVideoPlayerEl()
    if (!videoPlayer) {
      return window.innerWidth
    }
    return _.get(videoPlayer, 'parentElement.parentElement.offsetWidth', window.innerWidth)
  }

  render() {
    var videoPlayerClasses = cx({
      'video-js': true,
      'vjs-fill': this.props.resize,
      'vjs-default-skin': this.props.vjsDefaultSkin,
      'vjs-big-play-centered': this.props.vjsBigPlayCentered
    });
    var inputProps = this.props.options
    return (
      <video ref="videoPlayer" 
        className={videoPlayerClasses}
        {...inputProps}
      >
        {this.props.children || this.renderDefaultWarning()}
      </video>
    );
  }
}
