declare module 'bpmn-js/lib/Viewer' {
  class Viewer {
    constructor(options: { container: HTMLElement; keyboard?: { bindTo: HTMLElement | Window } });
    importXML(xml: string): Promise<void>;
    destroy(): void;
    get(service: string): unknown;
  }
  export default Viewer;
}

declare module 'bpmn-js/lib/NavigatedViewer' {
  class NavigatedViewer {
    constructor(options: { container: HTMLElement; keyboard?: { bindTo: HTMLElement | Window } });
    importXML(xml: string): Promise<void>;
    destroy(): void;
    get(service: string): unknown;
  }
  export default NavigatedViewer;
}

declare module 'bpmn-js/lib/Modeler' {
  class Modeler {
    constructor(options: { container: HTMLElement; keyboard?: { bindTo: HTMLElement | Window } });
    importXML(xml: string): Promise<void>;
    saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
    destroy(): void;
    get(service: string): unknown;
    on(event: string, callback: (event: { element: { id: string; type: string } }) => void): void;
  }
  export default Modeler;
}
