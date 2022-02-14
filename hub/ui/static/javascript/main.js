const HOME_LATITUDE = 46.78657339107215;
const HOME_LONGITUDE = 6.806581635522576;
const REFRESH_RATE = 1000 * 10; // 10 secs
const LONG_REFRESH_RATE = 1000 * 60; // 1 minute
const VERY_LONG_REFRESH_RATE = 1000 * 60 * 60; // 1 hour

function http_get(url) {
    return fetch(url, {
        method: 'GET',
        cache: 'no-cache',
    })
}
function http_put(url, body) {
    return fetch(url, {
        method: 'PUT',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        body: body,
    })
}

function http_post(url, body) {
    return fetch(url, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        body: body,
    })
}

function number_to_2_chars(number) {
    if (number < 10) {
        return "0" + number;
    }

    return number;
}

// Fire a function:
// * immediately,
// * every `timeout`,
// * when the document is back to visible.
function fire(timeout, func, ...args) {
    let timeout_id = null;

    function next(...new_args) {
        if (timeout_id != null) {
            window.clearTimeout(timeout_id);
        }

        timeout_id = window.setTimeout(
            () => {
                func(next, ...new_args);
            },
            timeout,
            false,
        );
    }

    // Fire `func` if the document's visibility has changed to
    // `visible`. Otherwise, cancel the timeout set by `next`.
    document.addEventListener(
        'visibilitychange',
        () => {
            if (document.visibilityState == 'visible') {
                func(next, ...args)
            } else {
                if (timeout_id != null) {
                    window.clearTimeout(timeout_id);
                }
            }
        }
    );

    // Fire `func` immediately.
    func(next, ...args);
}

const READ_PROPERTY_CACHE = {};

async function read_property(base, property_name) {
    if (READ_PROPERTY_CACHE[base] == undefined) {
        READ_PROPERTY_CACHE[base] = {};
    }

    const base_origin = new URL(base).origin;

    if (READ_PROPERTY_CACHE[base][property_name] == undefined) {
        const property_response = await http_get(base);
        const property_json_response = await property_response.json();

        READ_PROPERTY_CACHE[base][property_name] = property_json_response;
    }

    const property_json_response = READ_PROPERTY_CACHE[base][property_name];
    const property_description = property_json_response.properties[property_name];
    const property_link = property_description.links[0].href;

    let value_reader;
    const extra_values = {};

    switch (property_description.type) {
    case 'integer':
    case 'number': {
        const unit = property_description.unit;
        let min = 0;
        let max = null;

        if (property_description.minimum) {
            min = property_description.minimum;
        }

        if (property_description.maximum) {
            max = property_description.maximum;
        }

        extra_values.min = min;
        extra_values.max = max;

        value_reader = async function () {
            const response = await http_get(base_origin + property_link);
            const json_response = await response.json();
            const value = json_response[property_name];
            let formatted_value = Math.round((value + Number.EPSILON) * 100) / 100;

            switch (unit) {
            case 'percent':
                formatted_value += '%';
                break;

            case 'watt':
                formatted_value += 'W';
                break;

            case 'ampere':
                formatted_value += 'A';
                break;

            case 'celsius':
                formatted_value = Math.round(formatted_value) + '°C';
                break;
            }

            return {
                value,
                formatted_value,
            };
        };

        break;
    }

    case 'string': {
        value_reader = async function () {
            const response = await http_get(base_origin + property_link);
            const json_response = await response.json();
            const value = json_response[property_name];

            return {value};
        };

        break;
    }

    case 'object': {
        value_reader = async function() {
            const response = await http_get(base_origin + property_link);
            const json_response = await response.json();
            const value = json_response[property_name];

            return {value};
        };
    }
    }

    return READ_PROPERTY_CACHE[base][property_name] = {
        link: property_link,
        value_reader,
        ...extra_values
    };
}

window.customElements.define(
    'my-nav',
    class extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
            let template = document.getElementById('template--nav');
            let template_content = template.content.cloneNode(true);

            this.attachShadow({mode: 'open'})
                .appendChild(template_content);
        }

        enter(name, onclick) {
            let root = this.shadowRoot;

            var link = document.createElement('a');
            link.setAttribute('href', '#');
            link.addEventListener('click', onclick);
            link.appendChild(document.createTextNode(name));

            var item = document.createElement('li');
            item.appendChild(link);

            let list = root.querySelector('ol');
            list.appendChild(item);
        }

        leave() {
            let last = this.shadowRoot.querySelector('li:last-child');

            if (last) {
                last.parentNode.removeChild(last);
            }
        }
    }
);

window.customElements.define(
    'my-things',
    class extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
            let template = document.getElementById('template--things');
            let template_content = template.content.cloneNode(true);

            this.attachShadow({mode: 'closed'})
                .appendChild(template_content);
        }
    }
);

window.customElements.define(
    'my-unlocated-things',
    class extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
            let template = document.getElementById('template--unlocated-things');
            let template_content = template.content.cloneNode(true);

            this.attachShadow({mode: 'closed'})
                .appendChild(template_content);
        }
    }
);

window.customElements.define(
    'my-thing',
    new function() {
        let thing_index = 0;

        return class extends HTMLElement {
            constructor() {
                super();
            }

            connectedCallback() {
                const template = document.getElementById('template--thing');
                const template_content = template.content.cloneNode(true);

                const thing = template_content.querySelector('.thing');
                thing.setAttribute('id', 'thing-' + thing_index);
                thing_index += 1;

                const shadow_root = this.attachShadow({mode: 'open'})
                      .appendChild(template_content);
            }
        };
    }
);

window.customElements.define(
    'my-expandable-thing',
    class extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
            const template = document.getElementById('template--expandable-thing');
            const template_content = template.content.cloneNode(true);
            
            const thing = template_content.querySelector('.thing--expandable');

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);

            const self = this;

            thing.querySelector('.thing--expandable-summary').addEventListener(
                'click',
                () => {
                    const nav = document.getElementById('nav');
                    const leaving = () => {
                        thing.setAttribute('aria-expanded', 'false')
                        nav.leave();
                    };

                    if (thing.getAttribute('aria-expanded') == 'false') {
                        thing.setAttribute('aria-expanded', 'true');
                        nav.enter('Tous les objets', leaving);
                    }
                }
            );
        }
    }
);

window.customElements.define(
    'my-meter-thing',
    class extends HTMLElement {
        constructor() {
            super();
        }

        async connectedCallback() {
            const template = document.getElementById('template--meter-thing');
            const template_content = template.content.cloneNode(true);

            const thing_primary_value_element = template_content.querySelector('.thing--meter-primary-value');
            const thing_secondary_value_element = template_content.querySelector('.thing--meter-secondary-value');
            const thing_meter_circle_element = template_content.querySelector('.thing--meter-meter .meter');

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);

            const circle_length = thing_meter_circle_element.getTotalLength();

            async function update(
                next,
                thing_value_element,
                property_value_reader,
                property_link,
                property_min,
                property_max,
                do_update_thing_meter_circle_element
            ) {
                const {value, formatted_value} = await property_value_reader();

                thing_value_element.innerHTML = formatted_value;

                if (do_update_thing_meter_circle_element) {
                    if (property_max != null) {
                        const percent = (value * circle_length) / property_max;
                        thing_meter_circle_element.style.strokeDasharray = percent + ' 100';
                    } else {
                        thing_meter_circle_element.style.strokeDasharray = '100 100';
                    }
                }

                next(
                    thing_value_element,
                    property_value_reader, 
                    property_link,
                    property_min,
                    property_max,
                    do_update_thing_meter_circle_element,
                );
            }

            const base = this.getAttribute('data-base').replace(/\/+$/, '');
            const primary_property = await read_property(base, this.getAttribute('data-property'));

            fire(
                REFRESH_RATE,
                update,
                thing_primary_value_element,
                primary_property.value_reader,
                primary_property.link,
                primary_property.min,
                primary_property.max,
                true,
            );

            if (this.hasAttribute('data-secondary-property')) {
                const secondary_property = await read_property(base, this.getAttribute('data-secondary-property'));

                fire(
                    REFRESH_RATE,
                    update,
                    thing_secondary_value_element,
                    secondary_property.value_reader,
                    secondary_property.link,
                    secondary_property.min,
                    secondary_property.max,
                    false,
                );
            } else {
                thing_primary_value_element.classList.add('thing--meter-primary-value-large');
            }
        }
    }
);

window.customElements.define(
    'my-solar-pv-thing',
    class extends HTMLElement {
        constructor() {
            super();
        }

        async connectedCallback() {
            const template = document.getElementById('template--solar-pv-thing');
            const template_content = template.content.cloneNode(true);

            const thing_frame = template_content.querySelector('.thing--frame');

            const thing_primary_value_element = template_content.querySelector('.thing--solar-pv-primary-value');
            const thing_meter_circle_element = template_content.querySelector('.thing--solar-pv-meter .meter');
            const thing_sunrise_element = template_content.querySelector('.thing--solar-pv-sunrise');
            const thing_sunset_element = template_content.querySelector('.thing--solar-pv-sunset');
            const thing_sun_element = template_content.querySelector('.thing--solar-pv-sun');

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);

            const base = this.getAttribute('data-base').replace(/\/+$/, '');
            const primary_property = await read_property(base, this.getAttribute('data-property'));

            let previous_now = new Date(0);
            let sunrise = null;
            let sunset = null;

            async function update(next) {
                // Update `thing_primary_value_element`.
                const {value, formatted_value} = await (primary_property.value_reader)();

                thing_primary_value_element.innerHTML = formatted_value;

                // Update `thing_sunrise_element` + `thing_sunset_element`.
                let now = new Date();

                /// The day has changed.
                if (previous_now.getDate() != now.getDate() || sunrise == null || sunset == null) {
                    previous_now = now;

                    let {
                        sunrise: next_sunrise,
                        sunset: next_sunset
                    } = sunrise_sunset(
                        HOME_LATITUDE,
                        HOME_LONGITUDE,
                        now.getFullYear(),
                        now.getMonth() + 1,
                        now.getDate()
                    );

                    sunrise = next_sunrise;
                    sunset = next_sunset;
                }

                thing_sunrise_element.innerHTML = sunrise.getHours() + ":" + number_to_2_chars(sunrise.getMinutes());
                thing_sunset_element.innerHTML = sunset.getHours() + ":" + number_to_2_chars(sunset.getMinutes());

                // Update `thing_sun_element`.

                /// No sun!
                if (now < sunrise || now > sunset) {
                    thing_sun_element.setAttribute('aria-hidden', true);
                    thing_frame.setAttribute('aria-disabled', true);
                }
                /// Position the sun.
                else {
                    thing_sun_element.setAttribute('aria-hidden', false);
                    thing_frame.setAttribute('aria-disabled', false);

                    let now_in_minutes = now.getHours() * 60 + now.getMinutes();
                    const min_sun = sunrise.getHours() * 60 + sunrise.getMinutes();
                    const max_sun = sunset.getHours() * 60 + sunset.getMinutes();
                    const circle_length = thing_meter_circle_element.getTotalLength();
                    const min_circle = circle_length / 2;
                    const max_circle = circle_length;

                    const pos = ((now_in_minutes - min_sun) / (max_sun - min_sun)) * (max_circle - min_circle) + min_circle;

                    const pos_point = thing_meter_circle_element.getPointAtLength(pos);
                    thing_sun_element.setAttributeNS(null, "cx", pos_point.x);
                    thing_sun_element.setAttributeNS(null, "cy", pos_point.y);
                }

                next();
            }

            fire(REFRESH_RATE, update);
        }
    }
);

window.customElements.define(
    'my-dhw-thing',
    class extends HTMLElement {
        constructor() {
            super();
        }

        async connectedCallback() {
            const template = document.getElementById('template--dhw-thing');
            const template_content = template.content.cloneNode(true);

            const thing_top_value_element = template_content.querySelector('.thing--dhw-top-value');
            const thing_bottom_value_element = template_content.querySelector('.thing--dhw-bottom-value');

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);

            const base = this.getAttribute('data-base').replace(/\/+$/, '');
            const top_property = await read_property(base, this.getAttribute('data-top-value'));
            const bottom_property = await read_property(base, this.getAttribute('data-bottom-value'));

            async function update(next) {
                const {
                    value: top_value,
                    formatted_value: top_formatted_value
                } = await (top_property.value_reader)();
                const {
                    value: bottom_value,
                    formatted_value: bottom_formatted_value
                } = await (bottom_property.value_reader)();

                thing_top_value_element.innerHTML = top_formatted_value;
                thing_bottom_value_element.innerHTML = bottom_formatted_value;

                next();
            }

            fire(LONG_REFRESH_RATE, update);
        }
    }
);

window.customElements.define(
    'my-ventilation-thing',
    class extends HTMLElement {
        constructor() {
            super();
        }

        async connectedCallback() {
            const template = document.getElementById('template--ventilation-thing');
            const template_content = template.content.cloneNode(true);

            const thing_frame = template_content.querySelector('.thing--frame');

            const thing_after_ground_coupled_heat_exchanger_element = template_content.querySelector('.thing--ventilation-after-ground-coupled-heat-exchanger');
            const thing_after_heat_recovery_exchanger_element = template_content.querySelector('.thing--ventilation-after-heat-recovery-exchanger');
            const thing_extracted_element = template_content.querySelector('.thing--ventilation-extracted');

            const thing_after_ground_coupled_heat_exchanger_meter_element = template_content.querySelector('.meter--ventilation-after-ground-coupled-heat-exchanger');
            const thing_after_heat_recovery_exchanger_meter_element = template_content.querySelector('.meter--ventilation-after-heat-recovery-exchanger');
            const thing_extracted_meter_element = template_content.querySelector('.meter--ventilation-extracted');

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);

            const base = this.getAttribute('data-base').replace(/\/+$/, '');

            const state_property = await read_property(base, this.getAttribute('data-state-property'));
            const after_ground_coupled_heat_exchanger_property = await read_property(base, this.getAttribute('data-after-ground-coupled-heat-exchanger-value'));
            const after_heat_recovery_exchanger_property = await read_property(base, this.getAttribute('data-after-heat-recovery-exchanger-value'));
            const extracted_property = await read_property(base, this.getAttribute('data-extracted-value'));

            const MAX_TEMPERATURE = 25;
            const MARGIN = 0.75; // in percent

            async function update(next) {
                async function subupdate(property, element, meter_element) {
                    let {value, formatted_value} = await (property.value_reader)();
                    element.innerHTML = formatted_value;

                    value = Math.min(value, MAX_TEMPERATURE);
                    let max_length = meter_element.getTotalLength();

                    meter_element.style.strokeDasharray = (value * (max_length * MARGIN)) / MAX_TEMPERATURE + ' ' + max_length;
                }

                subupdate(
                    after_ground_coupled_heat_exchanger_property,
                    thing_after_ground_coupled_heat_exchanger_element,
                    thing_after_ground_coupled_heat_exchanger_meter_element,
                );

                subupdate(
                    after_heat_recovery_exchanger_property,
                    thing_after_heat_recovery_exchanger_element,
                    thing_after_heat_recovery_exchanger_meter_element,
                );

                subupdate(
                    extracted_property,
                    thing_extracted_element,
                    thing_extracted_meter_element,
                );

                let {value: state_value} = await (state_property.value_reader)();

                if ('paused' == state_value) {
                    thing_frame.setAttribute('aria-disabled', true);
                } else {
                    thing_frame.setAttribute('aria-disabled', false);
                }

                next();
            }

            fire(LONG_REFRESH_RATE, update);
        }
    }
);

window.customElements.define(
    'my-weather-thing',
    new function() {
        const WEATHER_CONDITIONS = {
            0: { text: '(inconnue)', icon: '' },

            200: { text: 'Orage avec légère pluie', icon: '11d' },
            201: { text: 'Orage avec pluie', icon: '11d' },
            202: { text: 'Orage avec pluie importante', icon: '11d' },
            210: { text: 'Orage léger', icon: '11d' },
            211: { text: 'Orage', icon: '11d' },
            212: { text: 'Orage important', icon: '11d' },
            221: { text: 'Orage violent', icon: '11d' },
            230: { text: 'Orage avec bruine légère', icon: '11d' },
            231: { text: 'Orange avec bruine', icon: '11d' },
            232: { text: 'Orage avec bruine importante', icon: '11d' },

            300: { text: 'Légère bruine', icon: '09d' },
            301: { text: 'Bruine', icon: '09d' },
            302: { text: 'Bruine dense', icon: '09d' },
            310: { text: 'Pluie légère', icon: '09d' },
            311: { text: 'Pluie légère', icon: '09d' },
            312: { text: 'Pluie légère', icon: '09d' },
            313: { text: 'Douche de bruine', icon: '09d' },
            314: { text: 'Douche de bruine', icon: '09d' },
            321: { text: 'Douche de bruine', icon: '09d' },

            500: { text: 'Légère pluie', icon: '10d' },
            501: { text: 'Pluie modérée', icon: '10d' },
            502: { text: 'Pluie intense', icon: '10d' },
            503: { text: 'La douche', icon: '10d' },
            504: { text: 'Pluie extrême', icon: '10d' },
            511: { text: 'Pluie glaçante', icon: '13d' },
            520: { text: 'Pluie légère', icon: '09d' },
            521: { text: 'Pluie dense', icon: '09d' },
            522: { text: 'Pluie dense', icon: '09d' },
            531: { text: 'Pluie éparse', icon: '09d' },

            600: { text: 'Légère neige', icon: '13d' },
            601: { text: 'Neige', icon: '13d' },
            602: { text: 'Neige intense', icon: '13d' },
            611: { text: 'Neige fondue', icon: '13d' },
            612: { text: 'Légère neige fondue', icon: '13d' },
            613: { text: 'Neige fondue intense', icon: '13d' },
            615: { text: 'Légère pluie et neige', icon: '13d' },
            616: { text: 'Pluie et neige', icon: '13d' },
            620: { text: 'Neige', icon: '13d' },
            621: { text: 'Neige', icon: '13d' },
            622: { text: 'Neige intense', icon: '13d' },

            701: { text: 'Brume', icon: '50d' },
            711: { text: 'Brume intense', icon: '50d' },
            721: { text: 'Brouillard', icon: '50d' },
            731: { text: 'Tourbillon de poussières', icon: '50d' },
            741: { text: 'Brouillard', icon: '50d' },
            751: { text: 'Sable', icon: '50d' },
            761: { text: 'Poussière', icon: '50d' },
            762: { text: 'Cendres volcanique', icon: '50d' },
            771: { text: 'Bourrasques', icon: '50d' },
            781: { text: 'Tonarde', icon: '50d' },

            800: { text: 'Ciel dégagé', icon: '01d' },
            801: { text: 'Partiellement nuageux', icon: '02d' },
            802: { text: 'Parsemé de nuages', icon: '03d' },
            803: { text: 'Nuageux', icon: '04d' },
            804: { text: 'Couvert', icon: '04d' },
        };

        return class extends HTMLElement {
            constructor() {
                super();
            }

            async connectedCallback() {
                let template = document.getElementById('template--weather-thing');
                let template_content = template.content.cloneNode(true);

                const thing_frame = template_content.querySelector('.thing--frame');

                const thing_temperature_element = template_content.querySelector('.thing--weather-temperature');
                const thing_apparent_temperature_element = template_content.querySelector('.thing--weather-apparent-temperature > span');
                const thing_condition_element = template_content.querySelector('.thing--weather-condition');
                const thing_condition_icon_element = template_content.querySelector('.thing--weather-condition-icon > img');
                const thing_forecast_element = template_content.querySelector('.thing--weather-forecast');

                this.attachShadow({mode: 'closed'})
                    .appendChild(template_content);

                const base = this.getAttribute('data-base').replace(/\/+$/, '');
                const forecast_base = this.getAttribute('data-forecast-base').replace(/\/+$/, '');

                const temperature_property = await read_property(base, this.getAttribute('data-temperature-value'));
                const apparent_temperature_property = await read_property(base, this.getAttribute('data-apparent-temperature-value'));
                const condition_property = await read_property(base, this.getAttribute('data-condition-value'));
                const forecast_property = await read_property(forecast_base, this.getAttribute('data-forecast-value'));
                async function update(next) {
                    const { formatted_value: temperature_formatted_value } = await (temperature_property.value_reader)();
                    const { formatted_value: apparent_temperature_formatted_value } = await (apparent_temperature_property.value_reader)();
                    const { value: condition_value } = await (condition_property.value_reader)();
                    const { value: forecast_value } = await (forecast_property.value_reader)();

                    const weather_condition = WEATHER_CONDITIONS[condition_value] || WEATHER_CONDITIONS[0];
                    thing_temperature_element.innerHTML = temperature_formatted_value;
                    thing_apparent_temperature_element.innerHTML = apparent_temperature_formatted_value;
                    thing_condition_element.innerHTML = weather_condition.text;
                    thing_condition_icon_element.setAttribute('src', 'static/icons/weather/' + weather_condition.icon + '.svg');

                    let formatted_forecast = '';

                    const today = new Date();
                    today.setHours(0);
                    today.setMinutes(0);
                    today.setSeconds(0);
                    today.setMilliseconds(0);

                    for (const f of forecast_value) {
                        const date = adjust_time_to_local(f.datetime * 1000);
                        const conditions = WEATHER_CONDITIONS[f.conditions[0].id] || WEATHER_CONDITIONS[0];

                        let date_extra = '';

                        if (today.getDate() != date.getDate()) {
                            date_extra = ` <small>(+${Math.floor((date - today) / (1000 * 60 * 60 * 24))}j)</small>`;
                        }

                        let octas = Math.floor(f.clouds / 12.5);
                        let formatted_octas = `${octas} octa`;

                        if (octas > 1) {
                            formatted_octas += 's';
                        }

                        formatted_forecast += `<div class="thing--weather-one-forecast">
  <h5 class="thing--weather-one-forecast--datetime">${date.getHours()}h${date_extra}</h5>
  <h6 class="thing--weather-one-forecast--title"><span>Ciel</span></h6>
  <div class="thing--weather-one-forecast--condition-icon"><img src="static/icons/weather/${conditions.icon}.svg" alt="condition icon" /></div>
  <div class="thing--weather-one-forecast--condition">${conditions.text}</div>
  <div class="thing--weather-one-forecast--cloudiness">${formatted_octas}</div>

  <div class="thing--weather-one-forecast--uv-index">${Math.round((f.uv_index + Number.EPSILON) * 100) / 100}UV<sub>ix</sub></div>
  <h6 class="thing--weather-one-forecast--title"><span>Températures</span></h6>
  <div class="thing--weather-one-forecast--temperature">${Math.round((f.temperature + Number.EPSILON) * 10) / 10}°C</div>
  <div class="thing--weather-one-forecast--apparent-temperature">(${Math.round((f.apparent_temperature + Number.EPSILON) * 10) / 10}°C)</div>
  <h6 class="thing--weather-one-forecast--title"><span>Air</span></h6>
  <div class="thing--weather-one-forecast--humidity">${f.humidity}%H</div>
  <div class="thing--weather-one-forecast--pressure">${f.pressure}hPa</div>
  <h6 class="thing--weather-one-forecast--title"><span>Vent</span></h6>
  <div class="thing--weather-one-forecast--wind-speed">${Math.round((f.wind_speed + Number.EPSILON) * 10) / 10}m/s</div>
  <div class="thing--weather-one-forecast--wind-degree"><svg class="icon" style="transform: rotate(${f.wind_degree + 180}deg)"><use href="#icon-compass" /></div>
</div>`;
                    }
                    
                    thing_forecast_element.innerHTML += formatted_forecast;

                    next();
                }

                fire(VERY_LONG_REFRESH_RATE, update);
            }
        }
    }
);

window.customElements.define(
    'my-actionable-thing',
    class extends HTMLElement {
        constructor() {
            super();
        }

        async connectedCallback() {
            const template = document.getElementById('template--actionable-thing');
            const template_content = template.content.cloneNode(true);

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);
        }
    }
);

window.customElements.define(
    'my-thing--pulse',
    class extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
            const template = document.getElementById('template--thing-pulse');
            const template_content = template.content.cloneNode(true);

            const button = template_content.querySelector('.thing--pulse');

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);

            const self = this;
            const base = self.getAttribute('data-base').replace(/\/+$/, '');
            const url = base + '/properties/pulse';

            button.addEventListener(
                'click',
                () => {
                    http_put(url, '{"pulse": true}')
                }
            );
        }
    }
);

window.customElements.define(
    'my-thing--blind',
    class extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
            const template = document.getElementById('template--thing-blind');
            const template_content = template.content.cloneNode(true);

            const open_button = template_content.querySelector('.thing--blind-open');
            const stop_button = template_content.querySelector('.thing--blind-stop');
            const close_button = template_content.querySelector('.thing--blind-close');

            const shadow_root = this.attachShadow({mode: 'open'})
                  .appendChild(template_content);

            const self = this;
            const base = self.getAttribute('data-base').replace(/\/+$/, '');
            const open_url = base + '/actions/open';
            const stop_url = base + '/actions/stop';
            const close_url = base + '/actions/close';

            open_button.addEventListener(
                'click',
                () => {
                    http_post(open_url, '{"open": {}}')
                }
            );
            stop_button.addEventListener(
                'click',
                () => {
                    http_post(stop_url, '{"stop": {}}')
                }
            );
            close_button.addEventListener(
                'click',
                () => {
                    http_post(close_url, '{"close": {}}')
                }
            );
        }
    }
);

// Once the DOM is ready.
window.addEventListener(
    'DOMContentLoaded',
    () => {
        // Implement tabs for the navigation.
        new function() {
            const all_tablists = document.querySelectorAll('[role="tablist"]');

            all_tablists.forEach(
                (tablist) => {
                    const all_tabs = tablist.querySelectorAll('[role="tab"]');

                    all_tabs.forEach(
                        (tab) => {
                            tab.addEventListener(
                                'click',
                                () => {
                                    const is_not_selected = tab.getAttribute('aria-selected') == "false";

                                    if (is_not_selected) {
                                        all_tabs.forEach(
                                            (tab) => {
                                                tab.setAttribute('aria-selected', 'false');
                                                document.getElementById(tab.getAttribute('aria-controls')).setAttribute('aria-hidden', 'true');
                                            }
                                        );
                                        tab.setAttribute('aria-selected', 'true');
                                        document.getElementById(tab.getAttribute('aria-controls')).setAttribute('aria-hidden', 'false');
                                    }
                                }
                            );
                        }
                    );
                }
            );
        };
    }
);
