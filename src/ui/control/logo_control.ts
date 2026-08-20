import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {ControlPosition, IControl} from './control';

/**
 * The {@link LogoControl} options object
 */
export type LogoControlOptions = {
    /**
     * If `true`, force a compact logo.
     * If `false`, force the full logo. The default is a responsive logo that collapses when the map is less than 640 pixels wide.
     */
    compact?: boolean;
};

/**
 * A `LogoControl` is a control that adds the watermark.
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * map.addControl(new LogoControl({compact: false}));
 * ```
 **/
export class LogoControl implements IControl {
    options: LogoControlOptions;
    _map: Map;
    _compact: boolean;
    _container: HTMLElement;

    /**
     * @param options - the control's options
     */
    constructor(options: LogoControlOptions = {}) {
        // Branding: default to NON-compact. Upstream leaves `compact` undefined, which its
        // `_updateCompact` then treats as "auto-compact below 640px".
        this.options = {compact: false, ...options};
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
        this._map = map;
        this._compact = this.options?.compact;
        this._container = DOM.create('div', 'mapmetricsgl-ctrl');
        const anchor = DOM.create('a', 'mapmetricsgl-ctrl-logo');
        anchor.target = '_blank';
        anchor.rel = 'noopener nofollow';
        anchor.href = 'https://mapmetrics.org/';
        anchor.setAttribute('aria-label', this._map._getUIString('LogoControl.Title'));
        anchor.setAttribute('rel', 'noopener nofollow');
        this._container.appendChild(anchor);
        this._container.style.display = 'block';

        this._map.on('resize', this._updateCompact);
        this._updateCompact();

        return this._container;
    }

    /** {@inheritDoc IControl.onRemove} */
    onRemove() {
        this._container.remove();
        this._map.off('resize', this._updateCompact);
        this._map = undefined;
        this._compact = undefined;
    }

    _updateCompact = () => {
        const containerChildren = this._container.children;
        if (containerChildren.length) {
            const anchor = containerChildren[0];
            // Branding: compact ONLY when explicitly requested. Upstream's automatic
            // auto-compact below 640px is removed deliberately — the wordmark stays 180px.
            if (this._compact === true) {
                anchor.classList.add('mapmetricsgl-compact');
            } else {
                anchor.classList.remove('mapmetricsgl-compact');
            }
        }
    };

}
