define([
    'common/utils/_',
    'bean',
    'bonzo',
    'qwery',
    'common/utils/$',
    'common/utils/ajax',
    'common/utils/url',
    'common/utils/config',
    'common/utils/mediator',
    'common/utils/fsm',
    'common/utils/detect',
    'common/modules/component',
    'common/modules/ui/images',
    'common/utils/template'
], function (
    _,
    bean,
    bonzo,
    qwery,
    $,
    ajax,
    url,
    config,
    mediator,
    FiniteStateMachine,
    detect,
    Component,
    imagesModule,
    template
) {
    function GalleryLightbox() {

        // CONFIG
        this.showEndslate = detect.getBreakpoint() !== 'mobile' && config.page.section !== 'childrens-books-site';
        this.useSwipe = detect.hasTouchScreen();
        this.swipeThreshold = 0.05;

        // TEMPLATE
        function generateButtonHTML(label) {
            var tmpl =
                '<div class="gallery-lightbox__btn gallery-lightbox__btn--{{label}} js-gallery-{{label}}">' +
                    '<button class="gallery-lightbox__btn-body"><i></i>{{label}}</button>' +
                '</div>';
            return template(tmpl, {label: label});
        }

        this.endslateHTML =
            '<li class="gallery-lightbox__item gallery-lightbox__item--endslate js-gallery-slide">' +
                '<div class="gallery-lightbox__endslate js-gallery-endslate"></div>' +
            '</li>';

        this.loaderHTML =
            '<div class="pamplemousse gallery-lightbox__loader js-loader">' +
                '<div class="pamplemousse__pip"><i></i></div>' +
                '<div class="pamplemousse__pip"><i></i></div>' +
                '<div class="pamplemousse__pip"><i></i></div>' +
            '</div>';

        this.imgElementHtml =
            '<li class="gallery-lightbox__item gallery-lightbox__item--img js-gallery-slide">' +
                '<div class="gallery-lightbox__img-container"><img class="gallery-lightbox__img js-gallery-lightbox-img""></div>' +
                '<div class="gallery-lightbox__info js-gallery-lightbox-info">' +
                    '<div class="gallery-lightbox__progress gallery-lightbox__progress--info">' +
                        '<span class="gallery-lightbox__index">{{index}}</span>' +
                        '<span class="gallery-lightbox__progress-separator"></span>' +
                        '<span class="gallery-lightbox__count">{{count}}</span>' +
                    '</div>' +
                    '<div class="gallery-lightbox__img-caption">{{caption}}</div>' +
                    '<div class="gallery-lightbox__img-credit">{{credit}}</div>' +
                '</div>' +
            '</li>';


        this.galleryLightboxHtml =
            '<div class="overlay gallery-lightbox gallery-lightbox--closed gallery-lightbox--hover">' +
                '<div class="gallery-lightbox__sidebar">' +
                    generateButtonHTML('close') +
                    '<div class="gallery-lightbox__progress  gallery-lightbox__progress--sidebar">' +
                        '<span class="gallery-lightbox__index js-gallery-index"></span>' +
                        '<span class="gallery-lightbox__progress-separator"></span>' +
                        '<span class="gallery-lightbox__count js-gallery-count"></span>' +
                    '</div>' +
                    generateButtonHTML('next') +
                    generateButtonHTML('prev') +
                    generateButtonHTML('info-button') +
                '</div>' +

                '<div class="js-gallery-swipe gallery-lightbox__swipe-container">' +
                    '<ul class="gallery-lightbox__content js-gallery-content">' +
                    '</ul>' +
                '</div>' +

            '</div>';

        // ELEMENT BINDINGS
        this.lightboxEl = bonzo.create(this.galleryLightboxHtml);
        this.$lightboxEl = bonzo(this.lightboxEl).prependTo(document.body);
        this.$indexEl = $('.js-gallery-index', this.lightboxEl);
        this.$countEl = $('.js-gallery-count', this.lightboxEl);
        this.$contentEl = $('.js-gallery-content', this.lightboxEl);
        this.nextBtn = qwery('.js-gallery-next', this.lightboxEl)[0];
        this.prevBtn = qwery('.js-gallery-prev', this.lightboxEl)[0];
        this.closeBtn = qwery('.js-gallery-close', this.lightboxEl)[0];
        this.infoBtn = qwery('.js-gallery-info-button', this.lightboxEl)[0];
        this.$swipeContainer = $('.js-gallery-swipe');
        bean.on(this.nextBtn, 'click', this.trigger.bind(this, 'next'));
        bean.on(this.prevBtn, 'click', this.trigger.bind(this, 'prev'));
        bean.on(this.closeBtn, 'click', this.close.bind(this));
        bean.on(this.infoBtn, 'click', this.trigger.bind(this, 'toggle-info'));
        this.handleKeyEvents = this._handleKeyEvents.bind(this); // bound for event handler
        this.toggleInfo = this.trigger.bind(this, 'toggle-info');
        this.resize = this.trigger.bind(this, 'resize');

        this.stopPropagationOnMouseClick = function(e) {
            if (detect.isBreakpoint({min: 'desktop'})) {
                e.stop();
            }
        }.bind(this);

        if (detect.hasTouchScreen()) {
            this.disableHover();
        }

        bean.on(window, 'popstate', function(event) {
            if (event.state === null) {
                this.trigger('close');
            }
        }.bind(this));

        // FSM CONFIG
        this.fsm = new FiniteStateMachine({
            initial: 'closed',
            onChangeState: function(oldState, newState) {
                this.$lightboxEl
                    .removeClass('gallery-lightbox--' + oldState)
                    .addClass('gallery-lightbox--' + newState);
            },
            context: this,
            states: this.states
        });
    }

    GalleryLightbox.prototype.generateImgHTML = function(img, i) {
        return template(this.imgElementHtml, {
            count: this.images.length,
            index: i,
            caption: img.caption,
            credit: img.displayCredit ? img.credit : ''
        });
    };

    GalleryLightbox.prototype.initSwipe = function() {

        var threshold, ox, dx,
            updateTime = 20; // time in ms

        bean.on(this.$swipeContainer[0], 'touchstart', function(e) {
            threshold = this.swipeContainerWidth * this.swipeThreshold;
            ox = e.touches[0].pageX;
            dx = 0;
        }.bind(this));

        var touchMove = function(e) {
            e.preventDefault();
            if ( e.touches.length > 1 || e.scale && e.scale !== 1) {
                return;
            }
            dx = e.touches[0].pageX - ox;
            this.translateContent(this.index, dx, updateTime);
        }.bind(this);

        bean.on(this.$swipeContainer[0], 'touchmove', _.throttle(touchMove, updateTime, {trailing: false}));

        bean.on(this.$swipeContainer[0], 'touchend', function() {
            var direction;
            if (Math.abs(dx) > threshold) {
                direction = dx > threshold ? 1 : -1;
            } else {
                direction = 0;
            }
            dx = 0;

            if (direction === 1) {
                this.index > 1 ? this.trigger('prev') : this.trigger('reload');
            } else if (direction === -1) {
                this.index < this.$slides.length ? this.trigger('next') : this.trigger('reload');
            } else {
                this.trigger('reload');
            }

        }.bind(this));
    };

    GalleryLightbox.prototype.disableHover = function() {
        this.$lightboxEl.removeClass('gallery-lightbox--hover');
    };

    GalleryLightbox.prototype.trigger = function(event, data) {
        this.fsm.trigger(event, data);
    };

    GalleryLightbox.prototype.loadGalleryfromJson = function(galleryJson, startIndex) {
        this.index = startIndex;
        if (this.galleryJson && galleryJson.id === this.galleryJson.id) {
            this.trigger('open');
        } else {
            this.trigger('loadJson', galleryJson);
        }
    };

    GalleryLightbox.prototype.getImgSrc = function(imgJson, width, height) {
        var possibleWidths = _.filter(imagesModule.availableWidths, function(w) {
            var widthBigger = w > width,
                calculatedHeight = (w/imgJson.ratio),
                heightBigger =  calculatedHeight > height;
            return widthBigger || heightBigger;
        }).sort(function(a,b){ return a > b; }),
            chosenWidth = possibleWidths.length ? possibleWidths[0] : '-';

        return imgJson.src.replace('{width}', chosenWidth);
    };

    GalleryLightbox.prototype.loadSurroundingImages = function(index, count) {

        var dim = this.$lightboxEl.dim();
        _([-1,0,1]).map(function(i) { return index+i === 0 ? count - 1 : (index-1+i) % count; })
            .each(function(i){
                var imgSrc = this.getImgSrc(this.images[i], dim.width, dim.height),
                    $img = bonzo(this.$images[i]);
                if ($img.attr('src') !== imgSrc) {
                    var $parent = $img.parent()
                        .append(bonzo.create(this.loaderHTML));

                    $img.attr('src', imgSrc); // src can change with width so overwrite every time

                    bean.one($img[0], 'load', function() {
                        $('.js-loader', $parent[0]).remove();
                    });

                }
            }.bind(this));

    };

    GalleryLightbox.prototype.translateContent = function(imgIndex, offset, duration) {
        var px = -1 * (imgIndex-1) * this.swipeContainerWidth,
            contentEl = this.$contentEl[0];
        contentEl.style.webkitTransitionDuration = duration + 'ms';
        contentEl.style.mozTransitionDuration = duration + 'ms';
        contentEl.style.msTransitionDuration = duration + 'ms';
        contentEl.style.transitionDuration = duration + 'ms';
        contentEl.style.webkitTransform = 'translate(' + (px+offset) + 'px,0)' + 'translateZ(0)';
        contentEl.style.mozTransform = 'translate(' + (px+offset) + 'px,0)';
        contentEl.style.msTransform = 'translate(' + (px+offset) + 'px,0)';
        contentEl.style.transform = 'translate(' + (px+offset) + 'px,0)' + 'translateZ(0)';
    };

    GalleryLightbox.prototype.states = {

        'closed': {
            enter: function() {
                this.hide();
            },
            leave: function() {
                this.show();
                url.pushUrl({}, document.title, '/' + this.galleryJson.id);
            },
            events: {
                'open': function() {
                    this.swipe && this.swipe.slide(this.index, 0);
                    this.state = 'image';
                },
                'loadJson': function(json) {
                    this.galleryJson = json;
                    this.images = json.images;
                    this.$countEl.text(this.images.length);

                    var imagesHtml = _(this.images)
                        .map(function(img, i) { return this.generateImgHTML(img, i+1); }.bind(this))
                        .join('');

                    this.$contentEl.html(imagesHtml);

                    this.$images = $('.js-gallery-lightbox-img', this.$contentEl[0]);

                    if (this.showEndslate) {
                        this.loadEndslate();
                    }

                    this.$slides = $('.js-gallery-slide', this.$contentEl[0]);

                    if (this.useSwipe) {
                        this.initSwipe();
                    }

                    this.state = 'image';
                }
            }
        },

        'image': {
            enter: function() {

                this.swipeContainerWidth = this.$swipeContainer.dim().width;

                // load prev/current/next
                this.loadSurroundingImages(this.index, this.images.length);

                this.translateContent(this.index, 0, (this.useSwipe && detect.isBreakpoint({max: 'tablet'}) ? 100 : 0));

                url.pushUrl({}, document.title, '/' + this.galleryJson.id + '?index=' + this.index, true);

                // event bindings
                bean.on(this.$swipeContainer[0], 'click', '.js-gallery-content', this.toggleInfo);
                bean.on(this.$contentEl[0], 'click', '.js-gallery-lightbox-info', this.stopPropagationOnMouseClick);
                bean.on(window, 'resize', this.resize);

                // meta
                this.$indexEl.text(this.index);
            },
            leave: function() {
                bean.off(this.$swipeContainer[0], 'click', this.toggleInfo);
                bean.off(this.$contentEl[0], 'click', this.stopPropagationOnMouseClick);
                bean.off(window, 'resize', this.resize);
            },
            events: {
                'next': function(interactionType) {
                    this.trackInteraction(interactionType + ':next');
                    this.pulseButton(this.nextBtn);
                    if (this.index === this.images.length) { // last img
                        if (this.showEndslate) {
                            this.state = 'endslate';
                        } else {
                            this.index = 1;
                            this.reloadState = true;
                        }
                    } else {
                        this.index += 1;
                        this.reloadState = true;
                    }
                },
                'prev': function(interactionType) {
                    this.trackInteraction(interactionType + ':previous');
                    this.pulseButton(this.prevBtn);
                    if (this.index === 1) { // first img
                        if (this.showEndslate) {
                            this.state = 'endslate';
                        } else {
                            this.index = this.images.length;
                            this.reloadState = true;
                        }
                    } else {
                        this.index -= 1;
                        this.reloadState = true;
                    }
                },
                'reload': function() {
                    this.reloadState = true;
                },
                'toggle-info': function() {
                    this.pulseButton(this.infoBtn);
                    this.$lightboxEl.toggleClass('gallery-lightbox--show-info');
                },
                'hide-info': function() {
                    this.pulseButton(this.infoBtn);
                    this.$lightboxEl.removeClass('gallery-lightbox--show-info');
                },
                'show-info': function() {
                    this.pulseButton(this.infoBtn);
                    this.$lightboxEl.addClass('gallery-lightbox--show-info');
                },
                'resize': function() {
                    this.swipeContainerWidth = this.$swipeContainer.dim().width;
                    this.loadSurroundingImages(this.index, this.images.length); // regenerate src
                    this.translateContent(this.index, 0, 0);
                },
                'close': function() { this.state = 'closed'; }
            }
        },

        'endslate': {
            enter: function() {
                this.translateContent(this.$slides.length, 0, 0);
                this.index = this.images.length + 1;
                bean.on(window, 'resize', this.resize);
                imagesModule.upgrade(this.endslateEl);
            },
            leave: function() {
                bean.off(window, 'resize', this.resize);
            },
            events: {
                'next': function(interactionType) {
                    this.trackInteraction(interactionType + ':next');
                    this.pulseButton(this.nextBtn);
                    this.index = 1;
                    this.state = 'image';
                },
                'prev': function(interactionType) {
                    this.trackInteraction(interactionType + ':previous');
                    this.pulseButton(this.prevBtn);
                    this.index = this.images.length;
                    this.state = 'image';
                },
                'reload': function() {
                    this.reloadState = true;
                },
                'resize': function() {
                    this.swipeContainerWidth = this.$swipeContainer.dim().width;
                    this.translateContent(this.$slides.length, 0, 0);
                },
                'close': function() { this.state = 'closed'; }
            }
        }
    };

    GalleryLightbox.prototype.show = function() {
        var $body = bonzo(document.body);
        this.bodyScrollPosition = $body.scrollTop();
        $body.addClass('has-overlay');
        this.$lightboxEl.addClass('gallery-lightbox--open');
        bean.off(document.body, 'keydown', this.handleKeyEvents); // prevent double binding
        bean.on(document.body, 'keydown', this.handleKeyEvents);
    };

    GalleryLightbox.prototype.close = function() {
        url.hasHistorySupport ? url.back() : this.trigger('close');
    };

    GalleryLightbox.prototype.hide = function() {
        // remove has-overlay first to show body behind lightbox then scroll and
        // close the lightbox at the same time. this way we get no scroll flicker
        var $body = bonzo(document.body);
        $body.removeClass('has-overlay');
        bean.off(document.body, 'keydown', this.handleKeyEvents);
        window.setTimeout(function() {
            if (this.bodyScrollPosition) {
                $body.scrollTop(this.bodyScrollPosition);
            }
            this.$lightboxEl.removeClass('gallery-lightbox--open');
            imagesModule.upgrade();
            mediator.emit('ui:images:vh');
        }.bind(this), 1);
    };

    GalleryLightbox.prototype.pulseButton = function(button) {
        var $btn = bonzo(button);
        $btn.addClass('gallery-lightbox__button-pulse');
        window.setTimeout(function() { $btn.removeClass('gallery-lightbox__button-pulse'); }, 75);
    };

    GalleryLightbox.prototype._handleKeyEvents = function(e) {
        if (e.keyCode === 37) { // left
            this.trigger('prev');
        } else if (e.keyCode === 39) { // right
            this.trigger('next');
        } else if (e.keyCode === 38) { // up
            this.trigger('show-info');
        } else if (e.keyCode === 40) { // down
            this.trigger('hide-info');
        } else if (e.keyCode === 27) { // esc
            this.close();
        } else if (e.keyCode === 73) { // 'i'
            this.trigger('toggle-info');
        }
    };

    GalleryLightbox.prototype.endslate = new Component();

    GalleryLightbox.prototype.loadEndslate = function() {
        if (!this.endslate.rendered) {
            this.endslateEl = bonzo.create(this.endslateHTML);
            this.$contentEl.append(this.endslateEl);

            this.endslate.componentClass = 'gallery-lightbox__endslate';
            this.endslate.endpoint = '/gallery/most-viewed.json';
            this.endslate.ready = function () {
                imagesModule.upgrade(this.endslateEl);
            }.bind(this);
            this.endslate.prerender = function() {
                bonzo(this.elem).addClass(this.componentClass);
            };
            this.endslate.fetch(qwery('.js-gallery-endslate', this.endslateEl), 'html');
        }
    };

    GalleryLightbox.prototype.trackInteraction = function (str) {
        mediator.emit('module:clickstream:interaction', str);
    };

    function bootstrap() {
        var lightbox;
        bean.on(document.body, 'click', '.js-gallerythumbs', function(e) {
            e.preventDefault();

            var $el = bonzo(e.currentTarget),
                galleryHref = $el.attr('href') || $el.attr('data-gallery-url'),
                galleryHrefParts = galleryHref.split('?index='),
                parsedGalleryIndex = parseInt(galleryHrefParts[1], 10),
                galleryIndex = isNaN(parsedGalleryIndex) ? 1 : parsedGalleryIndex;// 1-based index
            lightbox = lightbox || new GalleryLightbox();
            lightbox.loadGalleryfromJson(config.page.galleryLightbox, galleryIndex);
        });

        if (config.page.contentType === 'Gallery') {
            lightbox = lightbox || new GalleryLightbox();
            var galleryId = '/' + config.page.pageId,
                match = /\?index=(\d+)/.exec(document.location.href);
            if (match) { // index specified so launch lightbox at that index
                url.pushUrl(null, document.title, galleryId, true); // lets back work properly
                lightbox.loadGalleryfromJson(config.page.galleryLightbox, parseInt(match[1], 10));
            }
        }
    }

    return {
        init: bootstrap,
        GalleryLightbox: GalleryLightbox
    };
});