
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
            className={`${active ? 'bg-purple-200' : ''} dualbox shadow-lg btn rounded-none hover:bg-purple-100 hover:border-black dark:hover:border-white focus:outline-none} ${extraCss}`} 
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
            className={`dualbox rounded-none hover:bg-purple-100 hover:border-black dark:hover:border-white p-2 focus:outline-none ${extraCss}`}
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
    {name, onChange, value, placeholder, type, extraCss, disabled, onFocus  }: 
    {name:string, onChange:(...args: any[]) => void, value:string|number, onFocus:(...args: any[]) => void, type:string, placeholder:string, extraCss:string, disabled:boolean}
) => 
{ return (
    <input
        name={name}
        type={type}
        value={value}
        disabled={disabled}
        onFocus={onFocus}
        onChange={onChange}
        placeholder={placeholder}
        className={`${extraCss} hover:border-black dark:hover:border-white dualbox p-2 text-sm focus:outline-none appearance-none`}
    />
);};


export const PrimaryBar = (
    {extraCss, values, labels}: 
    {extraCss:string, values: { label: string, percentage: number, value: string, color:string}[], labels:boolean}
) => { 
    let runningTotal = 0;
    return (
        <>
            <div className={`${extraCss} h-2 dualbox shadow-lg relative`}>
                {values.map((value, index) => {
                    const currentMarginLeft = runningTotal;
                    runningTotal += value.percentage;

                    return (
                        <div
                        key={index}
                        className={`absolute top-0 left-0 h-full ${value.color}`}
                        style={{ 
                            width: `${value.percentage}%`,
                            marginLeft: `${currentMarginLeft}%`,
                        }}
                    ></div>
                    );
                })}
            </div>
            {labels && (
                <div className="flex justify-between text-xs mt-1">
                    {values.map((value, index) => (
                        <div key={index} className="flex items-center space-x-1">
                            <div className={`h-2 w-2 ${value.color} rounded-full`}></div>
                            <span className="text-gray-500 dark:text-white">{`${value.label}: ${value.value}`}</span>
                        </div>
                    ))}
                </div>
            )}
        </>  
    );
};




