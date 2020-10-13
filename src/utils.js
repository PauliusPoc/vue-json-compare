const isArray = (item) => {
  if (item === 'array') {
    return true;
  }
  return Object.prototype.toString.call(item) === '[object Array]';
};

const isObject = (item) => {
  return Object.prototype.toString.call(item) === '[object Object]';
};

const needFormat = (type) => {
  return type === 'array' || type === 'object';
};

const getIndent = (level) => {
  if (level === 1) {
    return { textIndent: '20px' };
  }
  return { textIndent: `${level * 20}px` };
};

const getType = (item) => {
  let t = Object.prototype.toString.call(item);
  let match = /(?!\[).+(?=\])/g;
  t = t.match(match)[0].split(' ')[1];
  return t.toLowerCase();
};

const isComplexType = (param) => {
  return isObject(param) || isArray(param);
};

const isTheSametype = (oldState, newState) => {
  return (
    Object.prototype.toString.call(oldState) === Object.prototype.toString.call(newState)
  );
};

const mergeData = (_old, _new) => {
  // finally result
  let result = [];
  // each line No.
  let start = 1

  // convert array or object to Array<object> [{}]
  const convertObject = (param, lineType) => {
    let list = [];
    if (isComplexType(param)) {
      let showIndex = getType(param) === 'object';
      let keys = Object.keys(param);
      let length = keys.length;
      keys.forEach((key, index) => {
        let type = getType(param[key]);
        list.push({
          name: key,
          line: start++,
          value: convertObject(param[key], lineType),
          type: type,
          showIndex: showIndex,
          needComma: length !== index + 1,
          lineType: lineType,
          lastLineType: lineType,
          lastLine: isComplexType(param[key]) ? start++ : null,
        });
        _.orderBy(list, ['name'], ['desc']);
      });
      return list;
    } else {
      switch (getType(param)) {
        case 'number':
        case 'boolean':
        case 'regexp':
          return param.toString();
        case 'null':
          return 'null';
        case 'undefined':
          return 'undefined';
        case 'function':
          return ' ƒ() {...}';
        default:
          return `"${param.toString()}"`;
      }
    }
  };

  // return parsed data
  const parseValue = (key, value, showIndex, needComma, lineType) => {
    return {
      name: key,
      line: start++,
      value: convertObject(value, lineType),
      type: getType(value),
      showIndex: showIndex,
      needComma: needComma,
      lineType: lineType,
      lastLineType: lineType,
      lastLine: isComplexType(value) ? start++ : null,
    };
  };

  const arrayDiffs = (oldState, newState, target) => {
    const addedValues = newState.filter((value) => oldState.indexOf(value) === -1);
    const removedValues = oldState.filter((value) => newState.indexOf(value) === -1);
    const sameValues = oldState.filter((value) => newState.indexOf(value) !== -1);

    let key = 0;
    const showIndex = false;

    addedValues.forEach(addedValue => {
      target.push(
        parseValue(key, addedValue, showIndex, true, 'add')
      );
      key = key +1;
    })
    removedValues.forEach(removedValue => {
      target.push(
        parseValue(key, removedValue, showIndex, true, 'del')
      );
      key = key +1;
    })
    sameValues.forEach((sameValue, index) => {
      console.log(sameValue);
      const needComma = (index === sameValues.length -1) ? false : true;
      target.push(
        parseValue(key, sameValue, showIndex, needComma, 'none')
      );
      key = key +1;
    })

  }

  // merge two vars to target,target type Array<object>[{}]
  const parseData = (oldState, newState, target) => {
    if (_.isArray(oldState)) {
      arrayDiffs(oldState, newState, target);
    } else {
      let _oldKeys = Object.keys(oldState);
      let _newKeys = Object.keys(newState);
      let showIndex = isObject(newState);
      // deleted keys
      let _deletedKeys = _oldKeys.filter((oldKey) => !_newKeys.some((newKey) => newKey === oldKey));
      // not removed keys
      let _sameKeys = _oldKeys.filter((oldKey) => _newKeys.some((newKey) => newKey === oldKey));
      // new added keys
      let _addedKeys = _newKeys.filter((newKey) => !_oldKeys.some((oldKey) => oldKey === newKey));
      // push deleted keys
      _deletedKeys.forEach((key, index) => {
        let needComma = true;
        if (_sameKeys.length === 0 && _addedKeys.length === 0 && index === _deletedKeys.length - 1) {
          needComma = false;
        }
        target.push(parseValue(key, oldState[key], showIndex, needComma, 'del'));
      });

      // push new keys
      _addedKeys.forEach((key, index) => {
        target.push(
          parseValue(key, newState[key], showIndex, _addedKeys.length !== index + 1, 'add')
        );
      });
      // The core function: compare
      _sameKeys.forEach((key, index) => {
        let needComma = true;
        if (_addedKeys.length === 0 && index === _sameKeys.length - 1) {
          needComma = false;
        }
        if (oldState[key] === newState[key]) {
          target.push(parseValue(key, newState[key], showIndex, needComma, 'none'));
        } else if (isTheSametype(oldState[key], newState[key])) {
          if (isComplexType(newState[key])) { // && isArray
            let _target = parseValue(
              key,
              isArray(oldState[key]) ? [] : {},
              showIndex,
              needComma,
              'none'
            );
            target.push(_target);
            // back one step
            start -= 1;
            // go inside
            parseData(oldState[key], newState[key], _target.value);
            // rewrite lastline
            _target.lastLine = start++;
          } else {
            target.push(parseValue(key, oldState[key], showIndex, true, 'del'));
            target.push(parseValue(key, newState[key], showIndex, needComma, 'add'));
          }
        } else {
          target.push(parseValue(key, oldState[key], showIndex, true, 'del'));
          target.push(parseValue(key, newState[key], showIndex, needComma, 'add'));
        }
      });
    }
  };

  if (isTheSametype(_old, _new) && isComplexType(_new)) {
    parseData(_old, _new, result);
  } else {
    if (_old === _new) {
      result.push(parseValue(0, _new, false, false, 'none'));
    } else {
      result.push(parseValue(0, _old, false, true, 'del'));
      result.push(parseValue(1, _new, false, false, 'add'));
    }
  }
  return result;
};

export {
  isArray,
  isObject,
  needFormat,
  getIndent,
  getType,
  isComplexType,
  isTheSametype,
  mergeData,
};
