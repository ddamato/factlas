// @factlas/plugin-jsx — expected facts per construct (source: babel-jsx).

// --- import facts (one per specifier) ---
import React from 'react'; //            import  react            (default)
import { useState, useMemo } from 'react'; //  import react x2      (named)
import * as utils from './utils'; //     import  ./utils          (namespace)
import './side-effect.css'; //           import  ./side-effect.css (side-effect)
import { Button } from '@acme/ui'; //    import  @acme/ui         (named)

export function Showcase({ open }: { open: boolean }) {
  return (
    // jsx.element  section  (is_dom: true, imported_from: null)
    <section>
      {/* jsx.element  div  (is_dom: true) + jsx.attribute id="root" (literal) */}
      <div id="root">
        {/* jsx.element  Button  (is_dom: false, imported_from: '@acme/ui') */}
        {/* jsx.prop variant → literal 'primary'; size → literal 'lg';       */}
        {/* jsx.prop disabled → boolean literal 'true'; onClick → dynamic     */}
        <Button variant="primary" size="lg" disabled onClick={() => {}} />

        {/* jsx.prop tone → static-union ('a' | 'b') */}
        <Button tone={open ? 'a' : 'b'} />

        {/* jsx.element input (DOM) + jsx.attribute type → literal 'text' */}
        <input type="text" />

        {/* jsx.element Foo.Bar (member expression → always a component) */}
        {/* utils is a namespace import, so imported_from: './utils'      */}
        <utils.Panel />
      </div>
    </section>
  );
}

void React;
void useState;
void useMemo;
