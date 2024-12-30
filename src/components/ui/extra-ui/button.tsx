

export const PrimaryButton = (
    { name, disabled, active, onClick, extraCss, value }: 
    { name:string, disabled: boolean, active:boolean, onClick: (...args: any[]) => void, extraCss:string, value:string}
) => 
{ 
    return(
        <button 
            name={name} 
            disabled={disabled} 
            onClick={onClick} 
            className={` ${active ? "bg-purple-100" : "bg-white"} btn border-black border-2 text-black rounded-none hover:border-black hover:bg-purple-200 focus:outline-none } ${extraCss}`} 
        >
            {value}    
        </button>
    );
};

export const PrimarySelect = (
    { name, disabled, options, onChange, extraCss, value }: 
    { name: string, disabled: boolean, options: { label: string, value: string }[], onChange: (...args: any[]) => void, extraCss: string, value: string }
) => 
{ 
    return(
        <select
            name={name}
            disabled={disabled}
            onChange={onChange}
            value={value}
            className={`border-black border-2 text-black rounded-none bg-white hover:bg-purple-200 focus:outline-none focus:border-purple-300 ${extraCss}`}
        >
            {options.map((option, index) => (
                <option key={index} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};

export const PrimaryInput = (
    {name, onChange, value, placeholder, type, extraCss, disabled  }: 
    {name:string, onChange:(...args: any[]) => void, value:string|number, type:string, placeholder:string, extraCss:string, disabled:boolean}
) => 
{ return (
    <input
        name={name}
        type={type}
        value={value}
        disabled={disabled}
        onChange={onChange}
        placeholder={placeholder}
        className={`${extraCss} border-2 border-gray-300 p-2 text-sm focus:outline-none focus:border-black appearance-none`}
    />
);};

/*? "border-black bg-gray-300"
            : "border-gray-500 bg-white"
            w-1/2 flex items-center justify-center px-4 py-2 text-sm font-medium hover:bg-gray-100` */