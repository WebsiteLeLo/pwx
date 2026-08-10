declare module "katex/contrib/auto-render" {
  type Delimiter = {
    left: string;
    right: string;
    display: boolean;
  };

  type AutoRenderOptions = {
    delimiters?: Delimiter[];
    throwOnError?: boolean;
    strict?: boolean | string;
    trust?: boolean | ((context: unknown) => boolean);
  };

  const renderMathInElement: (
    element: HTMLElement,
    options?: AutoRenderOptions,
  ) => void;

  export default renderMathInElement;
}